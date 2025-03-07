package wallet

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/hyperledger/fabric-sdk-go/pkg/gateway"
)

// SetupWallet sets up a wallet with user identities
func SetupWallet(walletPath string) error {
	// Create wallet directory if it doesn't exist
	if _, err := os.Stat(walletPath); os.IsNotExist(err) {
		os.MkdirAll(walletPath, 0755)
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
		fmt.Printf("Identity %s already exists in wallet\n", user)
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
		return fmt.Errorf("TLS certificate not found at %s: %v", tlsCertPath, err)
	}

	// Enroll admin first
	fmt.Println("Enrolling admin...")
	adminCmd := exec.Command("fabric-ca-client", "enroll",
		"-u", fmt.Sprintf("https://admin:adminpw@%s", caHost),
		"--caname", fmt.Sprintf("ca-%s", org),
		"--tls.certfiles", tlsCertPath,
		"--mspdir", filepath.Join(walletPath, "admin"))
	adminCmd.Env = append(os.Environ(),
		fmt.Sprintf("FABRIC_CA_CLIENT_HOME=%s", walletPath))

	output, err := adminCmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to enroll admin: %v, output: %s", err, output)
	}

	// Register user if not admin
	if user != "admin" {
		userPw := os.Getenv("FABRIC_USER_PASSWD")
		if userPw == "" {
			userPw = "userpw"
		}

		fmt.Printf("Registering user %s...\n", user)
		regCmd := exec.Command("fabric-ca-client", "register",
			"--id.name", user,
			"--id.secret", userPw,
			"--id.type", "client",
			"--tls.certfiles", tlsCertPath)
		regCmd.Env = append(os.Environ(),
			fmt.Sprintf("FABRIC_CA_CLIENT_HOME=%s", walletPath))

		output, err = regCmd.CombinedOutput()
		if err != nil {
			// Ignore if user already exists
			fmt.Printf("Note: %s (may be already registered which is OK)\n", output)
		}

		// Enroll user
		fmt.Printf("Enrolling user %s...\n", user)
		userCmd := exec.Command("fabric-ca-client", "enroll",
			"-u", fmt.Sprintf("https://%s:%s@%s", user, userPw, caHost),
			"--caname", fmt.Sprintf("ca-%s", org),
			"--tls.certfiles", tlsCertPath,
			"--mspdir", filepath.Join(walletPath, user))
		userCmd.Env = append(os.Environ(),
			fmt.Sprintf("FABRIC_CA_CLIENT_HOME=%s", walletPath))

		output, err = userCmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("failed to enroll %s: %v, output: %s", user, err, output)
		}
	}

	fmt.Printf("Successfully set up wallet with identity %s\n", user)
	return nil
}
