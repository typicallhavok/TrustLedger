package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/hyperledger/fabric-sdk-go/pkg/core/config"
	"github.com/hyperledger/fabric-sdk-go/pkg/gateway"
	"github.com/joho/godotenv"

	"your-module/config" // Your local config package
)

// APIHandler struct
type APIHandler struct {
	Contract *gateway.Contract
}

// EvidenceRequest struct for JSON input
type EvidenceRequest struct {
	TimeStamp        string `json:"timestamp"`
	ID               string `json:"id"`
	Hash             string `json:"hash"`
	OfficerRetriever string `json:"retriever"`
	OfficerHandler   string `json:"handler"`
	Location         string `json:"location"`
	DeviceType       string `json:"device_type"`
	Status           string `json:"status"`
}

// Connect to Hyperledger Fabric Gateway
func connectGateway() (*gateway.Contract, error) {
	// Load configuration
	walletPath, connectionPath, channelName, err := config.LoadConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %v", err)
	}

	// Check if connection file exists, generate if it doesn't
	if _, err := os.Stat(connectionPath); os.IsNotExist(err) {
		log.Println("Connection file not found, generating...")
		err = config.Generate()
		if err != nil {
			return nil, fmt.Errorf("failed to generate connection profile: %v", err)
		}
	}

	// Create wallet
	wallet, err := gateway.NewFileSystemWallet(walletPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create wallet: %v", err)
	}

	// Check if user identity exists
	user := os.Getenv("FABRIC_USER")
	if user == "" {
		user = "appUser"
	}

	if !wallet.Exists(user) {
		return nil, fmt.Errorf("identity %s not found in wallet, run setup script first", user)
	}

	// Connect to gateway
	gw, err := gateway.Connect(
		gateway.WithConfig(config.FromFile(connectionPath)),
		gateway.WithIdentity(wallet, user),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to gateway: %v", err)
	}

	// Get network and contract
	network, err := gw.GetNetwork(channelName)
	if err != nil {
		return nil, fmt.Errorf("failed to get network: %v", err)
	}

	contractName := os.Getenv("CONTRACT_NAME")
	if contractName == "" {
		contractName = "evidencecc"
	}

	contract := network.GetContract(contractName)
	return contract, nil
}

// Add evidence API endpoint
func (api *APIHandler) AddEvidence(c *fiber.Ctx) error {
	var req EvidenceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	_, err := api.Contract.SubmitTransaction("AddEvidence", req.TimeStamp, req.ID, req.Hash,
		req.OfficerRetriever, req.OfficerHandler, req.Location, req.DeviceType, req.Status)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Evidence added successfully"})
}

// Get evidence API endpoint
func (api *APIHandler) GetEvidence(c *fiber.Ctx) error {
	id := c.Params("id")
	response, err := api.Contract.EvaluateTransaction("GetEvidence", id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var evidence EvidenceRequest
	err = json.Unmarshal(response, &evidence)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse response"})
	}

	return c.JSON(evidence)
}

// Update status API endpoint
func (api *APIHandler) UpdateStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var req struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	_, err := api.Contract.SubmitTransaction("UpdateStatus", id, req.Status)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Status updated successfully"})
}

// Setup API Routes
func setupRoutes(app *fiber.App, api *APIHandler) {
	app.Post("/evidence", api.AddEvidence)
	app.Get("/evidence/:id", api.GetEvidence)
	app.Put("/evidence/:id/status", api.UpdateStatus)
}

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	}

	// Check if we need to regenerate connection profile
	if os.Getenv("REGENERATE_CONFIG") == "true" {
		log.Println("Regenerating connection profile...")
		err = config.Generate()
		if err != nil {
			log.Fatalf("Failed to regenerate connection profile: %v", err)
		}
	}

	// Connect to Fabric
	contract, err := connectGateway()
	if err != nil {
		log.Fatalf("Failed to connect to Fabric: %v", err)
	}

	// Setup API
	apiHandler := &APIHandler{Contract: contract}
	app := fiber.New()
	setupRoutes(app, apiHandler)

	// Get port from environment or use default
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Starting API server on port %s...\n", port)
	log.Fatal(app.Listen(":" + port))
}
