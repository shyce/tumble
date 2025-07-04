package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// getUserIDFromRequest extracts user ID from JWT token in Authorization header
func getUserIDFromRequest(r *http.Request, db *sql.DB) (int, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return 0, fmt.Errorf("no authorization header")
	}

	// Extract token from "Bearer <token>"
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return 0, fmt.Errorf("invalid authorization header format")
	}

	tokenString := parts[1]
	
	// Parse and validate JWT token
	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	if len(jwtSecret) == 0 {
		jwtSecret = []byte("default-secret-key")
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil {
		return 0, fmt.Errorf("failed to parse token: %v", err)
	}

	if !token.Valid {
		return 0, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, fmt.Errorf("invalid token claims")
	}

	userIDFloat, ok := claims["user_id"].(float64)
	if !ok {
		return 0, fmt.Errorf("user_id not found in token")
	}

	return int(userIDFloat), nil
}

type AuthHandler struct {
	db           *sql.DB
	jwtSecret    []byte
	googleConfig *oauth2.Config
}

type User struct {
	ID              int       `json:"id"`
	Email           string    `json:"email"`
	FirstName       string    `json:"first_name"`
	LastName        string    `json:"last_name"`
	Phone           *string   `json:"phone"`
	Role            string    `json:"role"`
	GoogleID        *string   `json:"google_id,omitempty"`
	AvatarURL       *string   `json:"avatar_url,omitempty"`
	EmailVerifiedAt *time.Time `json:"email_verified_at"`
	CreatedAt       time.Time `json:"created_at"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Phone     string `json:"phone,omitempty"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type GoogleUserInfo struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "fallback-secret-key"
	}

	googleConfig := &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("FRONTEND_URL") + "/auth/google/callback",
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}

	return &AuthHandler{
		db:           db,
		jwtSecret:    []byte(jwtSecret),
		googleConfig: googleConfig,
	}
}

func (h *AuthHandler) generateJWT(userID int) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
		"iat":     time.Now().Unix(),
	})

	return token.SignedString(h.jwtSecret)
}

func (h *AuthHandler) hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func (h *AuthHandler) checkPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func (h *AuthHandler) getUserByID(userID int) (*User, error) {
	query := `
		SELECT id, email, first_name, last_name, phone, role, google_id, avatar_url, email_verified_at, created_at
		FROM users WHERE id = $1
	`
	
	user := &User{}
	err := h.db.QueryRow(query, userID).Scan(
		&user.ID, &user.Email, &user.FirstName, &user.LastName,
		&user.Phone, &user.Role, &user.GoogleID, &user.AvatarURL,
		&user.EmailVerifiedAt, &user.CreatedAt,
	)
	
	if err != nil {
		return nil, err
	}
	
	return user, nil
}

func (h *AuthHandler) getUserByEmail(email string) (*User, error) {
	query := `
		SELECT id, email, first_name, last_name, phone, role, google_id, avatar_url, email_verified_at, created_at
		FROM users WHERE email = $1
	`
	
	user := &User{}
	err := h.db.QueryRow(query, email).Scan(
		&user.ID, &user.Email, &user.FirstName, &user.LastName,
		&user.Phone, &user.Role, &user.GoogleID, &user.AvatarURL,
		&user.EmailVerifiedAt, &user.CreatedAt,
	)
	
	if err != nil {
		return nil, err
	}
	
	return user, nil
}

func (h *AuthHandler) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	// Validate password length (minimum 8 characters)
	if len(req.Password) < 8 {
		http.Error(w, "Password must be at least 8 characters long", http.StatusBadRequest)
		return
	}

	// Validate email format
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(req.Email) {
		http.Error(w, "Invalid email format", http.StatusBadRequest)
		return
	}

	// Check if user already exists
	existingUser, _ := h.getUserByEmail(req.Email)
	if existingUser != nil {
		http.Error(w, "User already exists", http.StatusConflict)
		return
	}

	// Hash password
	hashedPassword, err := h.hashPassword(req.Password)
	if err != nil {
		http.Error(w, "Error processing password", http.StatusInternalServerError)
		return
	}

	// Create user
	query := `
		INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
		VALUES ($1, $2, $3, $4, $5, 'customer')
		RETURNING id, created_at
	`
	
	var userID int
	var createdAt time.Time
	phone := &req.Phone
	if req.Phone == "" {
		phone = nil
	}
	
	err = h.db.QueryRow(query, req.Email, hashedPassword, req.FirstName, req.LastName, phone).Scan(&userID, &createdAt)
	if err != nil {
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	// Generate JWT
	token, err := h.generateJWT(userID)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	// Get created user
	user, err := h.getUserByID(userID)
	if err != nil {
		http.Error(w, "Error retrieving user", http.StatusInternalServerError)
		return
	}

	response := AuthResponse{
		Token: token,
		User:  *user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *AuthHandler) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	// Get user by email
	query := `SELECT id, password_hash FROM users WHERE email = $1`
	var userID int
	var passwordHash string
	
	err := h.db.QueryRow(query, req.Email).Scan(&userID, &passwordHash)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Check password
	if !h.checkPassword(req.Password, passwordHash) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate JWT
	token, err := h.generateJWT(userID)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	// Get user details
	user, err := h.getUserByID(userID)
	if err != nil {
		http.Error(w, "Error retrieving user", http.StatusInternalServerError)
		return
	}

	response := AuthResponse{
		Token: token,
		User:  *user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *AuthHandler) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Generate state parameter for security
	state := generateRandomString(32)
	
	// Store state in session or temporary store (simplified for now)
	url := h.googleConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h *AuthHandler) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "No code provided", http.StatusBadRequest)
		return
	}

	// Exchange code for token
	token, err := h.googleConfig.Exchange(context.Background(), code)
	if err != nil {
		http.Error(w, "Failed to exchange token", http.StatusInternalServerError)
		return
	}

	// Get user info from Google
	client := h.googleConfig.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		http.Error(w, "Failed to get user info", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var googleUser GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		http.Error(w, "Failed to decode user info", http.StatusInternalServerError)
		return
	}

	// Check if user exists by Google ID
	var userID int
	query := `SELECT id FROM users WHERE google_id = $1`
	err = h.db.QueryRow(query, googleUser.ID).Scan(&userID)

	if err == sql.ErrNoRows {
		// Check if user exists by email
		existingUser, _ := h.getUserByEmail(googleUser.Email)
		if existingUser != nil {
			// Link Google account to existing user
			updateQuery := `UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3`
			_, err = h.db.Exec(updateQuery, googleUser.ID, googleUser.Picture, existingUser.ID)
			if err != nil {
				http.Error(w, "Error linking account", http.StatusInternalServerError)
				return
			}
			userID = existingUser.ID
		} else {
			// Create new user
			now := time.Now()
			insertQuery := `
				INSERT INTO users (email, first_name, last_name, google_id, avatar_url, email_verified_at, role)
				VALUES ($1, $2, $3, $4, $5, $6, 'customer')
				RETURNING id
			`
			err = h.db.QueryRow(insertQuery, googleUser.Email, googleUser.GivenName, 
				googleUser.FamilyName, googleUser.ID, googleUser.Picture, &now).Scan(&userID)
			if err != nil {
				http.Error(w, "Error creating user", http.StatusInternalServerError)
				return
			}
		}
	}

	// Generate JWT
	jwtToken, err := h.generateJWT(userID)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	// Redirect to frontend with token
	frontendURL := os.Getenv("FRONTEND_URL")
	redirectURL := fmt.Sprintf("%s/auth/callback?token=%s", frontendURL, jwtToken)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func generateRandomString(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// Middleware to verify JWT
func (h *AuthHandler) verifyToken(tokenString string) (*jwt.Token, error) {
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return h.jwtSecret, nil
	})
}

func (h *AuthHandler) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			http.Error(w, "Invalid authorization format", http.StatusUnauthorized)
			return
		}

		token, err := h.verifyToken(tokenString)
		if err != nil || !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "Invalid token claims", http.StatusUnauthorized)
			return
		}

		userID, ok := claims["user_id"].(float64)
		if !ok {
			http.Error(w, "Invalid user ID in token", http.StatusUnauthorized)
			return
		}

		// Add user ID to request context
		ctx := context.WithValue(r.Context(), "user_id", int(userID))
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}