package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type ServiceHandler struct {
	db *sql.DB
}

type Service struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	BasePrice    float64 `json:"base_price"`
	PricePerPound *float64 `json:"price_per_pound,omitempty"`
	IsActive     bool    `json:"is_active"`
}

func NewServiceHandler(db *sql.DB) *ServiceHandler {
	return &ServiceHandler{db: db}
}

// handleGetServices returns all available services
func (h *ServiceHandler) handleGetServices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	rows, err := h.db.Query(`
		SELECT id, name, description, base_price, price_per_pound, is_active
		FROM services
		WHERE is_active = true
		ORDER BY 
			CASE 
				WHEN name = 'standard_bag' THEN 1
				WHEN name = 'rush_bag' THEN 2
				WHEN name = 'additional_bag' THEN 3
				WHEN name = 'comforter' THEN 4
				ELSE 5
			END,
			name`)
	if err != nil {
		http.Error(w, "Failed to fetch services", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	services := []Service{}
	for rows.Next() {
		var service Service
		err := rows.Scan(
			&service.ID, &service.Name, &service.Description,
			&service.BasePrice, &service.PricePerPound, &service.IsActive,
		)
		if err != nil {
			http.Error(w, "Failed to parse services", http.StatusInternalServerError)
			return
		}
		services = append(services, service)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}