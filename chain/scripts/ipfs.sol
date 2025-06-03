// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FileStorage {
    struct File {
        string cid;
        string name;
        address owner;
        uint timestamp;
    }

    File[] public files;

    event FileUploaded(string cid, string name, address indexed owner, uint timestamp);

    function uploadFile(string memory _cid, string memory _name) public {
        files.push(File(_cid, _name, msg.sender, block.timestamp));
        emit FileUploaded(_cid, _name, msg.sender, block.timestamp);
    }

    function getFile(uint _index) public view returns (string memory, string memory, address, uint) {
        File memory file = files[_index];
        return (file.cid, file.name, file.owner, file.timestamp);
    }

    function totalFiles() public view returns (uint) {
        return files.length;
    }
}
