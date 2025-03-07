#!/bin/bash
set -e

# Load environment variables
if [ -f .env ]; then
    source .env
fi

echo "Setting up Fabric network connection..."

# Check if the test network is running
if [ ! -d "$FABRIC_NETWORK_DIR/organizations" ]; then
    echo "Warning: Fabric network directory not found at $FABRIC_NETWORK_DIR"
    echo "Please start your Fabric test network first or update FABRIC_NETWORK_DIR in .env"

    # Continue anyway in case user is providing custom certificates
    echo "Continuing with setup (some features may not work)..."
fi

# Run the connection generator
echo "Generating connection profile..."
go run -v ./cmd/generate-config/main.go

echo "Setup complete! You can now start your API with: go run api.go"