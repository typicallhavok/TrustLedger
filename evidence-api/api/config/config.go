package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
)

// NetworkConfig represents the Hyperledger Fabric network configuration
type NetworkConfig struct {
	Name          string                   `json:"name"`
	Version       string                   `json:"version"`
	Client        ClientConfig             `json:"client"`
	Organizations map[string]OrgConfig     `json:"organizations"`
	Peers         map[string]PeerConfig    `json:"peers"`
	CAs           map[string]CAConfig      `json:"certificateAuthorities"`
	Channels      map[string]ChannelConfig `json:"channels,omitempty"`
	Orderers      map[string]OrdererConfig `json:"orderers,omitempty"`
}

type ClientConfig struct {
	Organization string `json:"organization"`
}

type OrgConfig struct {
	MSPID                  string   `json:"mspid"`
	Peers                  []string `json:"peers"`
	CertificateAuthorities []string `json:"certificateAuthorities"`
}

type PeerConfig struct {
	URL        string    `json:"url"`
	TLSCACerts TLSConfig `json:"tlsCACerts"`
}

type CAConfig struct {
	URL        string    `json:"url"`
	CAName     string    `json:"caName"`
	TLSCACerts TLSList   `json:"tlsCACerts"` // Fix: Use TLSList to store array
	Registrar  Registrar `json:"registrar"`
}

type TLSConfig struct {
	PEM string `json:"pem"` // Fix: Keep this as a string for Peers
}

type TLSList struct {
	PEM []string `json:"pem"` // Fix: Use an array for Certificate Authorities
}

type Registrar struct {
	EnrollID     string `json:"enrollId"`
	EnrollSecret string `json:"enrollSecret"`
}

type ChannelConfig struct {
	Orderers map[string]struct{} `json:"orderers,omitempty"`
	Peers    map[string]struct{} `json:"peers,omitempty"`
}

type OrdererConfig struct {
	URL        string    `json:"url"`
	TLSCACerts TLSConfig `json:"tlsCACerts"`
}

// LoadConfig loads configuration from environment variables
func LoadConfig() (string, string, string, error) {
	// Default values
	walletPath := getEnvOrDefault("WALLET_PATH", "wallet")
	connectionPath := getEnvOrDefault("CONNECTION_JSON_PATH", "connection-org1.json")
	channelName := getEnvOrDefault("CHANNEL_NAME", "mychannel")

	return walletPath, connectionPath, channelName, nil
}

// Generate generates a dynamic connection profile
func Generate() error {
	connectionPath := getEnvOrDefault("CONNECTION_JSON_PATH", "connection-org1.json")
	org := getEnvOrDefault("FABRIC_ORG", "Org1")
	mspID := getEnvOrDefault("FABRIC_MSPID", "Org1MSP")

	// Get peer information
	peerHosts := getEnvOrDefault("FABRIC_PEER_HOSTS", "localhost:7051,localhost:9051")
	peerHostList := strings.Split(peerHosts, ",")

	peerNames := getEnvOrDefault("FABRIC_PEER_NAMES", "peer0.org1.example.com,peer1.org1.example.com")
	peerNameList := strings.Split(peerNames, ",")

	// Get CA information
	caHost := getEnvOrDefault("FABRIC_CA_HOST", "localhost:7054")
	caName := getEnvOrDefault("FABRIC_CA_NAME", "ca.org1.example.com")
	caOrgName := getEnvOrDefault("FABRIC_CA_ORG_NAME", "ca-org1")

	// Create network configuration
	config := NetworkConfig{
		Name:    "fabric-network",
		Version: "1.0.0",
		Client: ClientConfig{
			Organization: org,
		},
		Organizations: make(map[string]OrgConfig),
		Peers:         make(map[string]PeerConfig),
		CAs:           make(map[string]CAConfig),
	}

	// Add peers to configuration
	var peersList []string
	for i, peerName := range peerNameList {
		if i < len(peerHostList) {
			peersList = append(peersList, peerName)

			// Get certificate
			certPath := fmt.Sprintf("%s/organizations/peerOrganizations/%s.example.com/peers/%s/tls/ca.crt",
				getEnvOrDefault("FABRIC_NETWORK_DIR", "."),
				strings.ToLower(org),
				peerName)

			certPEM := "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
			if _, err := os.Stat(certPath); err == nil {
				// File exists, read it
				certBytes, err := ioutil.ReadFile(certPath)
				if err == nil {
					certPEM = string(certBytes)
				}
			}

			// Add peer to configuration
			config.Peers[peerName] = PeerConfig{
				URL: fmt.Sprintf("grpcs://%s", peerHostList[i]),
				TLSCACerts: TLSConfig{
					PEM: certPEM, // Fix: Keep as a string for Peers
				},
			}
		}
	}

	// Add organization
	config.Organizations[org] = OrgConfig{
		MSPID:                  mspID,
		Peers:                  peersList,
		CertificateAuthorities: []string{caName},
	}

	// Add CA
	caCertPath := fmt.Sprintf("%s/organizations/fabric-ca/%s/tls-cert.pem",
		getEnvOrDefault("FABRIC_NETWORK_DIR", "."),
		strings.ToLower(org))

	caCertPEM := "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
	if _, err := os.Stat(caCertPath); err == nil {
		// File exists, read it
		caCertBytes, err := ioutil.ReadFile(caCertPath)
		if err == nil {
			caCertPEM = string(caCertBytes)
		}
	}

	config.CAs[caName] = CAConfig{
		URL:    fmt.Sprintf("https://%s", caHost),
		CAName: caOrgName,
		TLSCACerts: TLSList{
			PEM: []string{caCertPEM}, // Fix: Keep as an array for CAs
		},
		Registrar: Registrar{
			EnrollID:     "admin",
			EnrollSecret: "adminpw",
		},
	}

	// Create directory if it doesn't exist
	dir := filepath.Dir(connectionPath)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		os.MkdirAll(dir, 0755)
	}

	// Marshal the config to JSON
	jsonBytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("error marshaling JSON: %v", err)
	}

	// Write to file
	err = ioutil.WriteFile(connectionPath, jsonBytes, 0644)
	if err != nil {
		return fmt.Errorf("error writing to file: %v", err)
	}

	fmt.Printf("Connection profile generated at: %s\n", connectionPath)
	return nil
}

func getEnvOrDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
