// backend/contracts/LicenseManagement.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LicenseManagement {
    // 1. Enum định nghĩa các trạng thái của giấy phép
    enum LicenseStatus { PENDING, APPROVED, REJECTED }

    // 2. Struct lưu trữ thông tin giấy phép
    struct License {
        uint256 licenseId;
        
        string companyName;      // Tên công ty
        string companyAddress;   // Địa chỉ công ty
        string documentIpfsHash; // Hash của file tài liệu (ảnh)
        LicenseStatus status;
        address submitter;
        address reviewer;
    }
 
    // 3. Mapping lưu trữ giấy phép bằng ID
    mapping(uint256 => License) public licenses;

    // Biến đếm ID giấy phép
    uint256 public nextLicenseId = 1;

    // Địa chỉ của người kiểm duyệt (Admin)
    address public adminAddress;

    // Event để thông báo khi có thay đổi
    event LicenseSubmitted(uint256 licenseId, address indexed submitter);
    event LicenseReviewed(uint256 licenseId, LicenseStatus newStatus, address indexed reviewer);

    constructor(address _adminAddress) {
        adminAddress = _adminAddress;
    }

    // Modifier chỉ cho phép Admin gọi
    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "Only Admin can perform this action.");
        _;
    }

    // 4. Hàm gửi yêu cầu cấp phép (User submit)
    function submitLicense(
            string memory _companyName,
            string memory _companyAddress,
            string memory _documentIpfsHash
        ) public {
        uint256 id = nextLicenseId++;
        licenses[id] = License(
            id,
            _companyName,
            _companyAddress,
            _documentIpfsHash, // Hash của tài liệu (ảnh)
            LicenseStatus.PENDING,
            msg.sender,
            address(0) // Chưa có người duyệt
        );

        emit LicenseSubmitted(id, msg.sender);
    }

    // 5. Hàm duyệt giấy phép (Admin review)
    function reviewLicense(uint256 _licenseId, LicenseStatus _newStatus) public onlyAdmin {
        require(_licenseId > 0 && _licenseId < nextLicenseId, "Invalid License ID.");
        require(_newStatus == LicenseStatus.APPROVED || _newStatus == LicenseStatus.REJECTED, "Invalid Status.");
        
        License storage license = licenses[_licenseId];
        require(license.status == LicenseStatus.PENDING, "License already reviewed.");

        license.status = _newStatus;
        license.reviewer = msg.sender;

        emit LicenseReviewed(_licenseId, _newStatus, msg.sender);
    }
    
    // Hàm lấy tất cả ID giấy phép (để frontend hiển thị danh sách)
    function getAllLicenseIds() public view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](nextLicenseId - 1);
        for (uint256 i = 1; i < nextLicenseId; i++) {
            ids[i - 1] = i;
        }
        return ids;
    }
}