package main

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/hyperledger/fabric-sdk-go/pkg/client/ledger"
	"github.com/hyperledger/fabric-sdk-go/pkg/client/channel"
	"github.com/hyperledger/fabric-sdk-go/pkg/gateway"
)

// Hyperledger Fabric gateway connection variables
const (
	walletPath   = "wallet"
	ccpPath      = "connection-org1.json" // Change to your network configuration file
	contractName = "evidencecc" // Change this to your deployed chaincode name
)

// APIHandler struct
type APIHandler struct {
	Contract *gateway.Contract
}

// EvidenceRequest struct for JSON input
type EvidenceRequest struct {
	TimeStamp       string `json:"timestamp"`
	ID              string `json:"id"`
	Hash            string `json:"hash"`
	OfficerRetriever string `json:"retriever"`
	OfficerHandler  string `json:"handler"`
	Location        string `json:"location"`
	DeviceType      string `json:"device_type"`
	Status          string `json:"status"`
}

// Connect to Hyperledger Fabric Gateway
func connectGateway() (*gateway.Contract, error) {
	wallet, err := gateway.NewFileSystemWallet(walletPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create wallet: %v", err)
	}

	// Load network configuration
	gw, err := gateway.Connect(
		gateway.WithConfigOption("connection-org1.json"),
		gateway.WithIdentity(wallet, "appUser"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to gateway: %v", err)
	}

	network, err := gw.GetNetwork("mychannel")
	if err != nil {
		return nil, fmt.Errorf("failed to get network: %v", err)
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

	_, err := api.Contract.SubmitTransaction("AddEvidence", req.TimeStamp, req.ID, req.Hash, req.OfficerRetriever, req.OfficerHandler, req.Location, req.DeviceType, req.Status)
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
	contract, err := connectGateway()
	if err != nil {
		log.Fatalf("Failed to connect to Fabric: %v", err)
	}

	apiHandler := &APIHandler{Contract: contract}

	app := fiber.New()
	setupRoutes(app, apiHandler)

	log.Fatal(app.Listen(":3000"))
}
