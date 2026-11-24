package token

import (
	"crypto/rsa"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var publicKey *rsa.PublicKey

// LoadPublicKey waits until the auth server has written its public key.
func LoadPublicKey() {
	for {
		data, err := os.ReadFile("/keys/public/public.pem")
		if err == nil {
			if publicKey, err = jwt.ParseRSAPublicKeyFromPEM(data); err == nil {
				return
			}
		}
		log.Println("waiting for public key:", err)
		time.Sleep(time.Second)
	}
}

// Verify returns the username in a valid token. Wrong algorithm, bad signature, or expired tokens fail.
func Verify(tokenString string) (string, error) {
	claims := &jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims,
		func(*jwt.Token) (any, error) { return publicKey, nil },
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithExpirationRequired(),
	)
	return claims.Subject, err
}
