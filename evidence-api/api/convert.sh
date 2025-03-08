for user in appUser admin; do
  cert=$(awk 'NF {sub(/\r/, ""); printf "%s\\n", $0;}' wallet/$user/signcerts/cert.pem)
  key=$(awk 'NF {sub(/\r/, ""); printf "%s\\n", $0;}' wallet/$user/keystore/*_sk)

  cat > wallet/$user.id <<EOL
{
  "name": "$user",
  "mspId": "Org1MSP",
  "credentials": {
    "certificate": "$cert",
    "privateKey": "$key"
  }
}
EOL
done
