package main

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
)

type combatCase struct {
	RawDamage   float64 `json:"rawDamage"`
	Defense     float64 `json:"defense"`
	TargetLevel int     `json:"targetLevel"`
}

type combatBatchRequest struct {
	Cases []combatCase `json:"cases"`
}

type combatBatchResponse struct {
	Damages  []int `json:"damages"`
	Checksum int64 `json:"checksum"`
}

type pathCase struct {
	GridW    int   `json:"gridW"`
	GridH    int   `json:"gridH"`
	Blocked  []int `json:"blocked"`
	StartX   int   `json:"startX"`
	StartY   int   `json:"startY"`
	TargetX  int   `json:"targetX"`
	TargetY  int   `json:"targetY"`
}

type pathBatchRequest struct {
	Cases []pathCase `json:"cases"`
}

type pathBatchResponse struct {
	PathLengths []int `json:"pathLengths"`
	Checksum    int64 `json:"checksum"`
}

type node struct {
	idx int
	f   int
	g   int
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func computeDamageAfterMitigation(rawDamage, defense float64, targetLevel int) int {
	safeRaw := math.Max(1, rawDamage)
	safeDefense := math.Max(0, defense)
	safeLevel := math.Max(1, float64(targetLevel))
	k := 400 + safeLevel*50
	reduction := safeDefense / (safeDefense + k)
	finalDamage := math.Max(1, math.Floor(safeRaw*(1-reduction)))
	return int(finalDamage)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok": true,
	})
}

func handleCombatBatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method_not_allowed"})
		return
	}
	var req combatBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_json"})
		return
	}
	out := make([]int, len(req.Cases))
	var checksum int64
	for i, c := range req.Cases {
		dmg := computeDamageAfterMitigation(c.RawDamage, c.Defense, c.TargetLevel)
		out[i] = dmg
		checksum += int64(dmg)
	}
	writeJSON(w, http.StatusOK, combatBatchResponse{
		Damages:  out,
		Checksum: checksum,
	})
}

func manhattan(ax, ay, bx, by int) int {
	dx := ax - bx
	if dx < 0 {
		dx = -dx
	}
	dy := ay - by
	if dy < 0 {
		dy = -dy
	}
	return dx + dy
}

func shortestPathLen(c pathCase) int {
	if c.GridW <= 0 || c.GridH <= 0 {
		return -1
	}
	area := c.GridW * c.GridH
	start := c.StartY*c.GridW + c.StartX
	target := c.TargetY*c.GridW + c.TargetX
	if start < 0 || start >= area || target < 0 || target >= area {
		return -1
	}

	blocked := make([]bool, area)
	for _, idx := range c.Blocked {
		if idx >= 0 && idx < area {
			blocked[idx] = true
		}
	}
	if blocked[start] || blocked[target] {
		return -1
	}
	if start == target {
		return 0
	}

	const inf = int(^uint(0) >> 1)
	gScore := make([]int, area)
	for i := 0; i < area; i++ {
		gScore[i] = inf
	}
	inOpen := make([]bool, area)
	open := make([]node, 0, 256)

	gScore[start] = 0
	open = append(open, node{
		idx: start,
		g:   0,
		f:   manhattan(c.StartX, c.StartY, c.TargetX, c.TargetY),
	})
	inOpen[start] = true

	dirs := [][2]int{{1, 0}, {-1, 0}, {0, 1}, {0, -1}}
	for len(open) > 0 {
		best := 0
		for i := 1; i < len(open); i++ {
			if open[i].f < open[best].f {
				best = i
			}
		}
		current := open[best]
		open[best] = open[len(open)-1]
		open = open[:len(open)-1]
		inOpen[current.idx] = false

		if current.idx == target {
			return current.g
		}

		cx := current.idx % c.GridW
		cy := current.idx / c.GridW
		for _, d := range dirs {
			nx := cx + d[0]
			ny := cy + d[1]
			if nx < 0 || ny < 0 || nx >= c.GridW || ny >= c.GridH {
				continue
			}
			ni := ny*c.GridW + nx
			if blocked[ni] {
				continue
			}
			tentativeG := current.g + 1
			if tentativeG >= gScore[ni] {
				continue
			}
			gScore[ni] = tentativeG
			nf := tentativeG + manhattan(nx, ny, c.TargetX, c.TargetY)
			if !inOpen[ni] {
				open = append(open, node{idx: ni, g: tentativeG, f: nf})
				inOpen[ni] = true
			} else {
				for i := range open {
					if open[i].idx == ni {
						open[i].g = tentativeG
						open[i].f = nf
						break
					}
				}
			}
		}
	}

	return -1
}

func handlePathBatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method_not_allowed"})
		return
	}
	var req pathBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid_json"})
		return
	}
	out := make([]int, len(req.Cases))
	var checksum int64
	for i, c := range req.Cases {
		l := shortestPathLen(c)
		out[i] = l
		checksum += int64(l)
	}
	writeJSON(w, http.StatusOK, pathBatchResponse{
		PathLengths: out,
		Checksum:    checksum,
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func main() {
	port := 8088
	if raw := os.Getenv("ENGINE_PORT"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			port = parsed
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/v1/combat/batch", handleCombatBatch)
	mux.HandleFunc("/v1/path/batch", handlePathBatch)

	addr := ":" + strconv.Itoa(port)
	log.Printf("[engine-go] listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
