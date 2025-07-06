package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type DriverEarningsHandler struct {
	db        *sql.DB
	getUserID func(*http.Request, *sql.DB) (int, error)
}

func NewDriverEarningsHandler(db *sql.DB) *DriverEarningsHandler {
	return &DriverEarningsHandler{
		db:        db,
		getUserID: getUserIDFromRequest,
	}
}

type EarningsData struct {
	Today           float64 `json:"today"`
	ThisWeek        float64 `json:"thisWeek"`
	ThisMonth       float64 `json:"thisMonth"`
	Total           float64 `json:"total"`
	CompletedOrders int     `json:"completedOrders"`
	AveragePerOrder float64 `json:"averagePerOrder"`
	HoursWorked     float64 `json:"hoursWorked"`
	HourlyRate      float64 `json:"hourlyRate"`
}

type EarningsHistory struct {
	Date     string  `json:"date"`
	Orders   int     `json:"orders"`
	Earnings float64 `json:"earnings"`
	Hours    float64 `json:"hours"`
}

// requireDriver middleware
func (h *DriverEarningsHandler) requireDriver(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := h.getUserID(r, h.db)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var role string
		err = h.db.QueryRow("SELECT role FROM users WHERE id = $1", userID).Scan(&role)
		if err != nil || role != "driver" {
			http.Error(w, "Forbidden - Driver access required", http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// handleGetDriverEarnings returns earnings data for the authenticated driver
func (h *DriverEarningsHandler) handleGetDriverEarnings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	driverID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Calculate earnings based on completed route orders with DoorDash-style model
	earnings := &EarningsData{}

	// Earnings components for laundry service
	const pickupBasePay = 5.00        // Base pay per pickup
	const deliveryBasePay = 5.00      // Base pay per delivery  
	const commissionRate = 0.10       // 10% of order value
	const rushOrderBonus = 3.00       // Bonus for rush orders ($55 vs $45)
	const heavyLoadBonus = 2.00       // Bonus for bedding/comforters

	// Get today's earnings
	todayEarnings := h.calculateEarningsForPeriod(driverID, "today")
	earnings.Today = todayEarnings

	// Get this week's earnings
	weekEarnings := h.calculateEarningsForPeriod(driverID, "week")
	earnings.ThisWeek = weekEarnings

	// Get this month's earnings
	monthEarnings := h.calculateEarningsForPeriod(driverID, "month")
	earnings.ThisMonth = monthEarnings

	// Get total earnings and completed orders
	totalEarnings, totalOrders := h.calculateTotalEarnings(driverID)
	earnings.Total = totalEarnings
	earnings.CompletedOrders = totalOrders
	
	if totalOrders > 0 {
		earnings.AveragePerOrder = earnings.Total / float64(totalOrders)
	}

	// Calculate actual hours worked based on route durations
	earnings.HoursWorked = h.calculateActualHoursWorked(driverID)
	
	if earnings.HoursWorked > 0 {
		earnings.HourlyRate = earnings.Total / earnings.HoursWorked
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(earnings)
}

// calculateEarningsForPeriod calculates earnings for a specific time period
func (h *DriverEarningsHandler) calculateEarningsForPeriod(driverID int, period string) float64 {
	var dateCondition string
	switch period {
	case "today":
		dateCondition = "DATE(dr.route_date) = CURRENT_DATE"
	case "week":
		dateCondition = "DATE(dr.route_date) >= DATE_TRUNC('week', CURRENT_DATE) AND DATE(dr.route_date) <= CURRENT_DATE"
	case "month":
		dateCondition = "DATE(dr.route_date) >= DATE_TRUNC('month', CURRENT_DATE) AND DATE(dr.route_date) <= CURRENT_DATE"
	default:
		return 0.0
	}

	query := fmt.Sprintf(`
		SELECT 
			COUNT(ro.id) as delivery_count,
			COALESCE(SUM(o.total), 0) as order_value_total,
			COALESCE(SUM(o.tip), 0) as tips_total
		FROM route_orders ro
		JOIN driver_routes dr ON ro.route_id = dr.id
		JOIN orders o ON ro.order_id = o.id
		WHERE dr.driver_id = $1 
		AND ro.status = 'completed'
		AND %s
	`, dateCondition)

	var deliveryCount int
	var orderValueTotal, tipsTotal float64
	
	err := h.db.QueryRow(query, driverID).Scan(&deliveryCount, &orderValueTotal, &tipsTotal)
	if err != nil && err != sql.ErrNoRows {
		return 0.0
	}

	// Laundry service earnings calculation
	// For pickup routes: $5 per pickup + 10% commission + bonuses
	// For delivery routes: $5 per delivery + tips + bonuses
	basePay := float64(deliveryCount) * 5.00                   // $5 base per pickup/delivery
	commission := orderValueTotal * 0.10                       // 10% of order value
	tips := tipsTotal                                          // Customer tips
	rushBonus := h.calculateRushOrderBonus(driverID, period)  // Rush order bonuses
	heavyLoadBonus := h.calculateHeavyLoadBonus(driverID, period) // Bedding/comforter bonuses

	return basePay + commission + tips + rushBonus + heavyLoadBonus
}

// calculateTotalEarnings calculates total lifetime earnings
func (h *DriverEarningsHandler) calculateTotalEarnings(driverID int) (float64, int) {
	query := `
		SELECT 
			COUNT(ro.id) as delivery_count,
			COALESCE(SUM(o.total), 0) as order_value_total,
			COALESCE(SUM(o.tip), 0) as tips_total
		FROM route_orders ro
		JOIN driver_routes dr ON ro.route_id = dr.id
		JOIN orders o ON ro.order_id = o.id
		WHERE dr.driver_id = $1 
		AND ro.status = 'completed'
	`

	var deliveryCount int
	var orderValueTotal, tipsTotal float64
	
	err := h.db.QueryRow(query, driverID).Scan(&deliveryCount, &orderValueTotal, &tipsTotal)
	if err != nil && err != sql.ErrNoRows {
		return 0.0, 0
	}

	// Calculate total earnings with all components
	basePay := float64(deliveryCount) * 5.00
	commission := orderValueTotal * 0.10
	tips := tipsTotal
	rushBonus := h.calculateRushOrderBonus(driverID, "all")
	heavyLoadBonus := h.calculateHeavyLoadBonus(driverID, "all")

	totalEarnings := basePay + commission + tips + rushBonus + heavyLoadBonus
	return totalEarnings, deliveryCount
}

// calculateRushOrderBonus calculates bonuses for rush orders ($55 vs $45)
func (h *DriverEarningsHandler) calculateRushOrderBonus(driverID int, period string) float64 {
	var dateCondition string
	switch period {
	case "today":
		dateCondition = "DATE(dr.route_date) = CURRENT_DATE"
	case "week":
		dateCondition = "DATE(dr.route_date) >= DATE_TRUNC('week', CURRENT_DATE)"
	case "month":
		dateCondition = "DATE(dr.route_date) >= DATE_TRUNC('month', CURRENT_DATE)"
	default:
		dateCondition = "TRUE" // All time
	}

	// Count orders with rush pricing (total >= $55 for single bag, indicating rush service)
	query := fmt.Sprintf(`
		SELECT COUNT(ro.id) as rush_orders
		FROM route_orders ro
		JOIN driver_routes dr ON ro.route_id = dr.id
		JOIN orders o ON ro.order_id = o.id
		WHERE dr.driver_id = $1 
		AND ro.status = 'completed'
		AND o.total >= 55.00
		AND %s
	`, dateCondition)

	var rushOrders float64
	err := h.db.QueryRow(query, driverID).Scan(&rushOrders)
	if err != nil {
		return 0.0
	}

	return rushOrders * 3.00 // $3 bonus for rush orders
}

// calculateHeavyLoadBonus calculates bonuses for bedding/comforter orders
func (h *DriverEarningsHandler) calculateHeavyLoadBonus(driverID int, period string) float64 {
	var dateCondition string
	switch period {
	case "today":
		dateCondition = "DATE(dr.route_date) = CURRENT_DATE"
	case "week":
		dateCondition = "DATE(dr.route_date) >= DATE_TRUNC('week', CURRENT_DATE)"
	case "month":
		dateCondition = "DATE(dr.route_date) >= DATE_TRUNC('month', CURRENT_DATE)"
	default:
		dateCondition = "TRUE" // All time
	}

	// Look for orders with special instructions mentioning bedding or high total values indicating comforters
	query := fmt.Sprintf(`
		SELECT COUNT(ro.id) as heavy_orders
		FROM route_orders ro
		JOIN driver_routes dr ON ro.route_id = dr.id
		JOIN orders o ON ro.order_id = o.id
		WHERE dr.driver_id = $1 
		AND ro.status = 'completed'
		AND (o.special_instructions ILIKE '%%bedding%%' 
		     OR o.special_instructions ILIKE '%%comforter%%'
		     OR o.total >= 70.00)
		AND %s
	`, dateCondition)

	var heavyOrders float64
	err := h.db.QueryRow(query, driverID).Scan(&heavyOrders)
	if err != nil {
		return 0.0
	}

	return heavyOrders * 2.00 // $2 bonus for heavy/bulky loads
}

// calculateActualHoursWorked calculates total hours worked based on actual route times
func (h *DriverEarningsHandler) calculateActualHoursWorked(driverID int) float64 {
	query := `
		SELECT 
			COALESCE(
				SUM(
					EXTRACT(EPOCH FROM (actual_end_time - actual_start_time)) / 3600.0
				), 
				0
			) as total_hours
		FROM driver_routes 
		WHERE driver_id = $1 
		AND actual_start_time IS NOT NULL 
		AND actual_end_time IS NOT NULL
		AND status = 'completed'
	`

	var totalHours float64
	err := h.db.QueryRow(query, driverID).Scan(&totalHours)
	if err != nil {
		// Fallback to estimation if no actual times recorded
		return h.estimateHoursWorked(driverID)
	}

	// If no actual hours recorded, use estimation
	if totalHours == 0 {
		return h.estimateHoursWorked(driverID)
	}

	return totalHours
}

// estimateHoursWorked provides fallback estimation when actual times aren't available
func (h *DriverEarningsHandler) estimateHoursWorked(driverID int) float64 {
	query := `
		SELECT COUNT(DISTINCT dr.id) as route_count
		FROM driver_routes dr
		JOIN route_orders ro ON dr.id = ro.route_id
		WHERE dr.driver_id = $1 
		AND ro.status = 'completed'
	`

	var routeCount int
	err := h.db.QueryRow(query, driverID).Scan(&routeCount)
	if err != nil {
		return 0.0
	}

	// Realistic estimation for laundry routes:
	// - Pickup route: 2-3 hours (multiple stops, loading time)
	// - Delivery route: 2-3 hours (multiple stops, unloading time)
	const estimatedHoursPerRoute = 2.5
	return float64(routeCount) * estimatedHoursPerRoute
}

// calculateHoursForDate calculates hours worked on a specific date
func (h *DriverEarningsHandler) calculateHoursForDate(driverID int, date string) float64 {
	query := `
		SELECT 
			COALESCE(
				SUM(
					EXTRACT(EPOCH FROM (actual_end_time - actual_start_time)) / 3600.0
				), 
				0
			) as daily_hours
		FROM driver_routes 
		WHERE driver_id = $1 
		AND DATE(route_date) = $2
		AND actual_start_time IS NOT NULL 
		AND actual_end_time IS NOT NULL
		AND status = 'completed'
	`

	var dailyHours float64
	err := h.db.QueryRow(query, driverID, date).Scan(&dailyHours)
	if err != nil || dailyHours == 0 {
		// Fallback: estimate based on number of routes for this date
		routeQuery := `
			SELECT COUNT(DISTINCT dr.id) as route_count
			FROM driver_routes dr
			JOIN route_orders ro ON dr.id = ro.route_id
			WHERE dr.driver_id = $1 
			AND DATE(dr.route_date) = $2
			AND ro.status = 'completed'
		`
		
		var routeCount int
		err = h.db.QueryRow(routeQuery, driverID, date).Scan(&routeCount)
		if err != nil {
			return 0.0
		}
		
		// Estimate 2.5 hours per route
		return float64(routeCount) * 2.5
	}

	return dailyHours
}

// handleGetDriverEarningsHistory returns daily earnings history for the driver
func (h *DriverEarningsHandler) handleGetDriverEarningsHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	driverID, err := h.getUserID(r, h.db)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "week"
	}

	var daysBack int
	switch period {
	case "week":
		daysBack = 7
	case "month":
		daysBack = 30
	case "year":
		daysBack = 365
	default:
		daysBack = 7
	}

	// Laundry service rates
	const basePayPerDelivery = 5.00
	const commissionRate = 0.10
	const estimatedHoursPerDelivery = 0.75 // 45 minutes including drive time

	query := `
		SELECT 
			DATE(dr.route_date) as work_date,
			COUNT(ro.id) as completed_deliveries,
			COALESCE(SUM(o.total), 0) as order_value_total,
			COALESCE(SUM(o.tip), 0) as tips_total
		FROM route_orders ro
		JOIN driver_routes dr ON ro.route_id = dr.id
		JOIN orders o ON ro.order_id = o.id
		WHERE dr.driver_id = $1 
		AND ro.status = 'completed'
		AND DATE(dr.route_date) >= CURRENT_DATE - INTERVAL '%d days'
		AND DATE(dr.route_date) <= CURRENT_DATE
		GROUP BY DATE(dr.route_date)
		ORDER BY DATE(dr.route_date) DESC
		LIMIT 30
	`

	rows, err := h.db.Query(fmt.Sprintf(query, daysBack), driverID)
	if err != nil {
		http.Error(w, "Failed to fetch earnings history", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	history := []EarningsHistory{}
	for rows.Next() {
		var workDate time.Time
		var completedDeliveries int
		var orderValueTotal, tipsTotal float64

		err := rows.Scan(&workDate, &completedDeliveries, &orderValueTotal, &tipsTotal)
		if err != nil {
			continue
		}

		// Calculate laundry-specific earnings for this day
		basePay := float64(completedDeliveries) * basePayPerDelivery
		commission := orderValueTotal * commissionRate
		tips := tipsTotal
		
		// Simplified bonuses for daily view (could be enhanced)
		rushBonus := orderValueTotal * 0.02  // Estimate 2% of order value as rush bonuses
		heavyLoadBonus := float64(completedDeliveries) * 0.20 // Estimate $0.20 per delivery for heavy loads

		totalEarnings := basePay + commission + tips + rushBonus + heavyLoadBonus
		
		// Calculate hours for this specific date
		hours := h.calculateHoursForDate(driverID, workDate.Format("2006-01-02"))

		history = append(history, EarningsHistory{
			Date:     workDate.Format("2006-01-02"),
			Orders:   completedDeliveries,
			Earnings: totalEarnings,
			Hours:    hours,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}