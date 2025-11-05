import { useState, useEffect, useCallback } from "react";
import * as ethers from "ethers"; // Import tất cả dưới tên 'ethers'
import Web3Modal from "web3modal";
import LicenseManagementABI from "./LicenseManagement.json";
import { contractAddress } from "./config";
import { ipfsClient } from "./ipfsClient"; 
import SubmitLicenseForm from "./components/SubmitLicenseForm"; // Import Form nộp
import "./App.css";

// Enum từ Smart Contract (chỉ để hiển thị)
const StatusMap = {
  0: "CHỜ DUYỆT",
  1: "ĐÃ DUYỆT",
  2: "BỊ TỪ CHỐI",
};

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Kết nối Web3 và Contract
  const connectWallet = useCallback(async () => {
    const web3Modal = new Web3Modal({
      // Đảm bảo tên mạng này khớp với cấu hình Hardhat Local của bạn
      network: "hardhat local", 
      cacheProvider: true,
    });

    try {
      const connection = await web3Modal.connect();
      console.log("-> Đã kết nối Web3Modal.");
      console.log("Connection object:", connection);
      
      const newProvider = new ethers.providers.Web3Provider(connection);
      const newSigner = newProvider.getSigner();
      const newAccount = await newSigner.getAddress();

      setProvider(newProvider);
      setSigner(newSigner);
      setAccount(newAccount);

      // Kiểm tra xem tài khoản hiện tại có phải là Admin không (Lấy từ contract)
      const contract = new ethers.Contract(
        contractAddress,
        LicenseManagementABI.abi,
        newProvider
      );
      const adminAddress = await contract.adminAddress();
      console.log("Địa chỉ Metamask (newAccount):", newAccount);
      console.log("Địa chỉ Admin Contract:", adminAddress);
      setIsAdmin(newAccount.toLowerCase() === adminAddress.toLowerCase());
    } catch (error) {
      // Báo lỗi nếu không thể kết nối hoặc gọi contract (ví dụ: CALL_EXCEPTION)
      console.error("Lỗi kết nối ví:", error);
    }
  }, []);

  // 2. Tải danh sách giấy phép
  const fetchLicenses = useCallback(async () => {
    if (!provider) return;
    setLoading(true);

    try {
      const contract = new ethers.Contract(
        contractAddress,
        LicenseManagementABI.abi,
        provider
      );
      const ids = await contract.getAllLicenseIds();

      const licenseDetails = await Promise.all(
        ids.map((id) => contract.licenses(id))
      );

      setLicenses(
        licenseDetails.map((l) => ({
          id: l.licenseId.toNumber(),
          companyName: l.companyName,         // Thêm trường mới
          companyAddress: l.companyAddress,   // Thêm trường mới
          ipfsHash: l.documentIpfsHash,       // Đổi tên
          status: StatusMap[l.status],
          submitter: l.submitter,
          reviewer: l.reviewer,
        }))
      );
    } catch (error) {
      console.error("Lỗi khi tải giấy phép:", error);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  // 3. Hàm duyệt (Admin Action)
  const reviewLicense = async (licenseId, isApproved) => {
    if (!signer || !isAdmin) return;

    // 1: APPROVED, 2: REJECTED
    const newStatus = isApproved ? 1 : 2;

    try {
      const contract = new ethers.Contract(
        contractAddress,
        LicenseManagementABI.abi,
        signer
      );

      // Gửi transaction
      const tx = await contract.reviewLicense(licenseId, newStatus);
      await tx.wait(); 

      alert(
        `Giấy phép ID ${licenseId} đã được duyệt: ${
          isApproved ? "DUYỆT" : "TỪ CHỐI"
        }`
      );

      await fetchLicenses();
    } catch (error) {
      console.error("Lỗi khi duyệt giấy phép:", error);
      alert("Lỗi giao dịch! Kiểm tra console và đảm bảo bạn là Admin.");
    }
  };

  // Khởi tạo
  useEffect(() => {
    connectWallet();
  }, [connectWallet]);

  useEffect(() => {
    if (provider) {
      fetchLicenses();
    }
  }, [provider, fetchLicenses]);

  // Render UI
  if (!account) {
    return (
      <div className="container connect-section">
        <h1 className="main-title">Quản Lý Cấp Phép Kinh Doanh</h1>
        <button className="connect-btn" onClick={connectWallet}>Kết nối Metamask</button>
      </div>
    );
  }

  // Nếu không phải Admin, hiển thị form nộp hồ sơ
  if (!isAdmin) {
    return (
      <div className="container">
        <h1>Cổng Nộp Hồ Sơ Kinh Doanh</h1>
        <p style ={{ fontSize: '18px' }}>
          Tài khoản hiện tại: <strong>{account}</strong> (Vai trò: User)
        </p>
        <p>-----</p>
        <SubmitLicenseForm signer={signer} account={account} onSubmission={fetchLicenses} provider={provider} />
      </div>
    );
  }

  // Dashboard Admin
  return (
    <div className="admin-container">
      <h1 className="admin-title">Dashboard Kiểm Duyệt Giấy Phép</h1>

      <div className="admin-info">
        <p className="admin-account">
          Tài khoản Admin: <span className="account-text">{account}</span>
        </p>
        <p className="admin-status">
          Trạng thái: <span className="admin-role">ADMIN</span>
        </p>
      </div>

      <hr className="divider" />

      <h2 className="list-title">Danh Sách Giấy Phép (Tổng cộng: {licenses.length})</h2>

      {loading ? (
        <p className="loading-text">Đang tải...</p>
      ) : (
        <div className="table-container">
            <table className="license-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên Công ty / Địa chỉ</th>
              <th>Tài liệu IPFS</th>
              <th>Trạng thái</th>
              <th>Người Gửi</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {licenses.map((license) => (
              <tr key={license.id} className="license-row">
                <td>{license.id}</td>
                <td className="company-cell">
                  <strong>{license.companyName}</strong>
                  <br />
                  <small>({license.companyAddress})</small>
                </td>
                <td>
                  <a
                    className="ipfs-link"
                    href={`http://127.0.0.1:8081/ipfs/${license.ipfsHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    XEM TÀI LIỆU
                  </a>
                </td>
                <td className={`status-cell status-${license.status.replace(/\s/g, "").toLowerCase()}`}>
                  <strong>{license.status}</strong>
                </td>
                <td className="submitter-cell">
                  {license.submitter.substring(0, 8)}...
                </td>

                {license.status === "CHỜ DUYỆT" ? (
                  <td >
                    <div className="action-buttons"> 
                      <button
                      className="approve-btn"
                      onClick={() => reviewLicense(license.id, true)}
                    >
                      DUYỆT
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => reviewLicense(license.id, false)}
                    >
                      TỪ CHỐI
                    </button>
                    </div>
                  </td>
                ) : (
                  <td className="reviewed-by">
                    Đã xử lý bởi:{" "}
                    {license.reviewer !== "0x0000000000000000000000000000000000000000"
                      ? license.reviewer.substring(0, 8) + "..."
                      : "N/A"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        
      )}
    </div>
  );
}

export default App;
