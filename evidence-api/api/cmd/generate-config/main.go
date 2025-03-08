package main

import (
	"fmt"
	"log"
	"os"

	"github.com/sampriti/evidence-api/api/config"
	"github.com/sampriti/evidence-api/api/wallet"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if it exists
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Warning: .env file not found, using environment variables")
	}

	// Generate connection profile
	err = config.Generate()
	if err != nil {
		log.Fatalf("Failed to generate connection profile: %v", err)
	}

	// Setup wallet
	walletPath := os.Getenv("WALLET_PATH")
	if walletPath == "" {
		walletPath = "wallet"
	}

	err = wallet.SetupWallet(walletPath)
	if err != nil {
		log.Printf("Warning: Failed to set up wallet: %v", err)
		log.Println("You may need to set up wallet manually.")
	}

	fmt.Println("Configuration setup complete!")
}