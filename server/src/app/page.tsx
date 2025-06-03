"use client";

import React, { useState, useCallback } from 'react';

const Home: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [ipfsHash, setIpfsHash] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileUrl(URL.createObjectURL(selectedFile));
      setIpfsHash('');
      setError('');
    }
  }, []);

  const uploadToIPFS = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      // Create form data for the HTTP request
      const formData = new FormData();
      formData.append('file', file);

      // Use fetch API to post to IPFS API
      // Updated URL with proper parameters and CORS headers
      const response = await fetch('http://127.0.0.1:5001/api/v0/add', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setIpfsHash(result.Hash);
      setUploading(false);
    } catch (err) {
      console.error('Error uploading to IPFS:', err);
      setError('Error uploading to IPFS. Please check console for details.');
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Upload File to IPFS</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Select File
        </label>
        <input
          type="file"
          onChange={onFileChange}
          className="block w-full text-sm border border-gray-300 rounded p-2"
          disabled={uploading}
        />
      </div>

      {fileUrl && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Preview:</p>
          {file?.type.startsWith('image/') ? (
            <img src={fileUrl} alt="Preview" className="max-h-64 rounded" />
          ) : (
            <p className="text-sm">{file?.name} ({file?.type})</p>
          )}
        </div>
      )}

      <button
        onClick={uploadToIPFS}
        disabled={!file || uploading}
        className={`w-full py-2 px-4 rounded font-medium ${
          !file || uploading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {uploading ? 'Uploading...' : 'Upload to IPFS'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {ipfsHash && (
        <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          <p className="font-medium">Successfully uploaded to IPFS!</p>
          <p className="break-all mt-2">
            <span className="font-medium">IPFS Hash: </span>
            {ipfsHash}
          </p>
          <p className="mt-2">
            <a
              href={`http://127.0.0.1:8080/ipfs/${ipfsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on Local IPFS Gateway
            </a>
          </p>
          <p className="mt-1">
            <a
              href={`https://ipfs.io/ipfs/${ipfsHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on Public IPFS Gateway
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

export default Home;