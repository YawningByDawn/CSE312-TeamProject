package database

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

func InitDatabase() {
	var err error
	db, err = sql.Open("pgx", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL)`)
	if err != nil {
		log.Fatal(err)
	}
}

// RegisterUser returns false if the username is already taken.
func RegisterUser(username, password string) (bool, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return false, err
	}
	res, err := db.Exec(`INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`, username, string(hash))
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

func CheckUser(username, password string) bool {
	var hash string
	err := db.QueryRow(`SELECT password_hash FROM users WHERE username = $1`, username).Scan(&hash)
	return err == nil && bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
