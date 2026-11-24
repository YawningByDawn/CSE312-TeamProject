package token

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"log"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	privatePath = "/keys/private/private.pem"
	publicPath  = "/keys/public/public.pem"
	Lifetime    = 24 * time.Hour
)

var privateKey *rsa.PrivateKey

// InitKeys loads the private key, creating it on first boot, and publishes the public key for the app.
func InitKeys() {
	data, err := os.ReadFile(privatePath)
	if err != nil {
		key, _ := rsa.GenerateKey(rand.Reader, 2048)
		data = pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
		if err = os.WriteFile(privatePath, data, 0600); err != nil {
			log.Fatal(err)
		}
	}
	if privateKey, err = jwt.ParseRSAPrivateKeyFromPEM(data); err != nil {
		log.Fatal(err)
	}

	public, _ := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	err = os.WriteFile(publicPath, pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: public}), 0644)
	if err != nil {
		log.Fatal(err)
	}
}

func Sign(username string) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   username,
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(Lifetime)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(privateKey)
}
