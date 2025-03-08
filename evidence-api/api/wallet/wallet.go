package wallet

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/hyperledger/fabric-sdk-go/pkg/gateway"
)

// SetupWallet sets up a wallet with user identities
func SetupWallet(walletPath string) error {
	// Fix redundant wallet paths by checking if we're already in a wallet directory
	pwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get current working directory: %v", err)
	}

	// Check if walletPath contains a redundant "wallet" directory
	if filepath.Base(walletPath) == "wallet" && filepath.Base(pwd) == "wallet" {
		// Use parent directory to avoid nesting
		walletPath = filepath.Dir(pwd)
		fmt.Printf("Detected redundant wallet path, using %s instead\n", walletPath)
	}

	// Create wallet directory if it doesn't exist
	if _, err := os.Stat(walletPath); os.IsNotExist(err) {
		if err := os.MkdirAll(walletPath, 0755); err != nil {
			return fmt.Errorf("failed to create wallet directory: %v", err)
		}
		fmt.Printf("Created wallet directory at %s\n", walletPath)
	}

	// Check if wallet already contains appUser
	wallet, err := gateway.NewFileSystemWallet(walletPath)
	if err != nil {
		return fmt.Errorf("failed to create wallet: %v", err)
	}

	// Check if user already exists
	user := os.Getenv("FABRIC_USER")
	if user == "" {
		user = "appUser"
	}
	if wallet.Exists(user) {
		fmt.Printf("Identity %s already exists in wallet at %s\n", user, walletPath)
		return nil
	}

	// Identify Fabric network directory
	fabricNetworkDir := os.Getenv("FABRIC_NETWORK_DIR")
	if fabricNetworkDir == "" {
		fabricNetworkDir = "."
	}

	// Environment for CA client
	caHost := os.Getenv("FABRIC_CA_HOST")
	if caHost == "" {
		caHost = "localhost:7054"
	}

	org := os.Getenv("FABRIC_ORG")
	if org == "" {
		org = "Org1"
	}

	// Use fabric-ca-client
	err = runCAClient(fabricNetworkDir, walletPath, user, org, caHost)
	if err != nil {
		return err
	}

	return nil
}

// runCAClient executes fabric-ca-client to enroll users
func runCAClient(fabricNetworkDir, walletPath, user, org, caHost string) error {
	// Check if fabric-ca-client is available
	_, err := exec.LookPath("fabric-ca-client")
	if err != nil {
		return fmt.Errorf("fabric-ca-client not found: %v", err)
	}

	// Define TLS cert file path
	tlsCertPath := fmt.Sprintf("%s/organizations/fabric-ca/%s/tls-cert.pem",
		fabricNetworkDir,
		org)

	// Check if TLS cert exists
	if _, err := os.Stat(tlsCertPath); os.IsNotExist(err) {
		// Try alternative path if first attempt fails
		altTlsCertPath := fmt.Sprintf("%s/organizations/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem",
			fabricNetworkDir)
		if _, err := os.Stat(altTlsCertPath); os.IsNotExist(err) {
			return fmt.Errorf("TLS certificate not found at %s or %s", tlsCertPath, altTlsCertPath)
		}
		tlsCertPath = altTlsCertPath
		fmt.Printf("Using alternative TLS certificate path: %s\n", tlsCertPath)
	}

	// Get CA name from environment variables
	caName := os.Getenv("FABRIC_CA_NAME")
	if caName == "" {
		// Default to ca-org1 format with hyphen (based on logs)
		caName = fmt.Sprintf("ca-%s", strings.ToLower(org))
		fmt.Printf("Using default CA name: %s\n", caName)
	}

	// Enroll admin first
	fmt.Println("Enrolling admin...")
	adminCmd := exec.Command("fabric-ca-client", "enroll",
		"-u", fmt.Sprintf("https://admin:adminpw@%s", caHost),
		"--caname", caName,
		"--tls.certfiles", tlsCertPath,
		"--mspdir", filepath.Join(walletPath, "admin"))

	adminCmd.Env = append(os.Environ(),
		fmt.Sprintf("FABRIC_CA_CLIENT_HOME=%s", filepath.Dir(walletPath))) // Set FABRIC_CA_CLIENT_HOME to the parent directory
	output, err := adminCmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to enroll admin: %v, output: %s", err, output)
	}

	// Register user if not admin
	if user != "admin" {
		userPw := os.Getenv("FABRIC_USER_PASSWD")
		if userPw == "" {
			userPw = "appUserpw"
		}

		fmt.Printf("Registering user %s...\n", user)
		regCmd := exec.Command("fabric-ca-client", "register",
			"--id.name", user,
			"--id.secret", userPw,
			"--id.type", "client",
			"--tls.certfiles", tlsCertPath)

		regCmd.Env = append(os.Environ(),
			fmt.Sprintf("FABRIC_CA_CLIENT_HOME=%s", filepath.Dir(walletPath))) // Set FABRIC_CA_CLIENT_HOME to the parent directory
		output, err = regCmd.CombinedOutput()
		if err != nil {
			// Ignore if user already exists
			fmt.Printf("Note: %s (may be already registered which is OK)\n", output)
		}

		// Enroll user
		fmt.Printf("Enrolling user %s...\n", user)
		userCmd := exec.Command("fabric-ca-client", "enroll",
			"-u", fmt.Sprintf("https://%s:%s@%s", user, userPw, caHost),
			"--caname", caName,
			"--tls.certfiles", tlsCertPath,
			"--mspdir", filepath.Join(walletPath, user))

		userCmd.Env = append(os.Environ(),
			fmt.Sprintf("FABRIC_CA_CLIENT_HOME=%s", filepath.Dir(walletPath))) // Set FABRIC_CA_CLIENT_HOME to the parent directory
		output, err = userCmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("failed to enroll %s: %v, output: %s", user, err, output)
		}
	}

	fmt.Printf("Successfully set up wallet with identity %s at %s\n", user, walletPath)
	return nil
}
