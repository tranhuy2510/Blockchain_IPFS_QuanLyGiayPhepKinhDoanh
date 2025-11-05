import React, { useState, useEffect, useCallback } from 'react';
import * as ethers from "ethers";
import { ipfsClient } from '../ipfsClient';
import LicenseManagementABI from '../LicenseManagement.json';
import { contractAddress } from '../config';

// Enum từ Smart Contract (chỉ để hiển thị)
const StatusMap = {
    0: "CHỜ DUYỆT",
    1: "ĐÃ DUYỆT",
    2: "BỊ TỪ CHỐI",
};

// Component Modal xem chi tiết hồ sơ
const LicenseDetailModal = ({ license, onClose }) => {
    if (!license) return null;

    return (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <button onClick={onClose} style={closeButtonStyle}>&times;</button>
                <h3>Chi Tiết Hồ Sơ ID: {license.id}</h3>
                <p><strong>Tên Công ty:</strong> {license.companyName}</p>
                <p><strong>Địa chỉ:</strong> {license.companyAddress}</p>
                <p><strong>Trạng thái:</strong> <span style={{ fontWeight: 'bold', color: license.status === 'ĐÃ DUYỆT' ? 'green' : license.status === 'BỊ TỪ CHỐI' ? 'red' : 'orange' }}>{license.status}</span></p>
                
                <hr style={{ margin: '15px 0' }} />
                
                <h4>Tài liệu Kèm theo</h4>
                <p><strong>IPFS Hash:</strong> {license.ipfsHash}</p>
                <a 
                    href={`http://127.0.0.1:8081/ipfs/${license.ipfsHash}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={linkStyle}
                >
                    &#128065; Xem Tài liệu (Mở tab mới)
                </a>
            </div>
        </div>
    );
};


const SubmitLicenseForm = ({ signer, account, onSubmission, provider }) => {
    const [companyName, setCompanyName] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [document, setDocument] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userLicenses, setUserLicenses] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [selectedLicense, setSelectedLicense] = useState(null);
    const [fileName, setFileName] = useState(''); // State mới: Lưu tên tệp

     // 1. Lấy lịch sử hồ sơ của User hiện tại
    const fetchUserLicenses = useCallback(async () => {
        if (!provider || !account) return;
        setIsLoadingHistory(true);

        try {
            const contract = new ethers.Contract(contractAddress, LicenseManagementABI.abi, provider);
            const ids = await contract.getAllLicenseIds();
            
            const licenseDetails = await Promise.all(
                ids.map(id => contract.licenses(id))
            );

            // Lọc ra các hồ sơ do người dùng hiện tại nộp
            const filteredLicenses = licenseDetails
                .filter(l => l.submitter.toLowerCase() === account.toLowerCase())
                .map(l => ({
                    id: l.licenseId.toNumber(),
                    companyName: l.companyName,
                    companyAddress: l.companyAddress,
                    ipfsHash: l.documentIpfsHash,
                    status: StatusMap[l.status],
                    submitter: l.submitter,
                    reviewer: l.reviewer
                }));

            setUserLicenses(filteredLicenses);
        } catch (error) {
            console.error("Lỗi khi tải lịch sử hồ sơ:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [provider, account]);

    // Auto-fetch khi component load hoặc account/provider thay đổi
    useEffect(() => {
        if (provider && account) {
            fetchUserLicenses();
        }
    }, [provider, account, fetchUserLicenses]);

    // Xử lý thay đổi file
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setDocument(file);
        // Cập nhật tên tệp
        setFileName(file ? file.name : '');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!signer || !document || !companyName || !companyAddress) {
            alert("Vui lòng điền đầy đủ thông tin và chọn file.");
            return;
        }

        setIsSubmitting(true);
        let documentIpfsHash = '';

        try {
            // 1. Tải file tài liệu lên IPFS
            console.log("Bắt đầu tải file lên IPFS...");
            const added = await ipfsClient.add(document);
            documentIpfsHash = added.path;
            console.log("File tài liệu đã tải lên IPFS. Hash:", documentIpfsHash);

            // 2. Gọi Smart Contract
            const contract = new ethers.Contract(contractAddress, LicenseManagementABI.abi, signer);

            // Hàm submitLicense mới nhận 3 đối số: name, address, hash
            const tx = await contract.submitLicense(
                companyName,
                companyAddress,
                documentIpfsHash
            );
            await tx.wait();

            alert("Nộp hồ sơ thành công! Giấy phép đang chờ Admin duyệt.");

            // Reset form, tải lại lịch sử, và thông báo cho component cha (Admin Dashboard)
            setCompanyName('');
            setCompanyAddress('');
            setDocument(null);
            setFileName(''); // Reset tên tệp sau khi nộp
            fetchUserLicenses(); 
            if (onSubmission) onSubmission(); 

        } catch (error) {
            console.error("Lỗi khi nộp hồ sơ:", error);
            alert("Lỗi nộp hồ sơ. Kiểm tra Metamask (đủ gas), Hardhat Node và IPFS Desktop.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const showDetails = (license) => {
        setSelectedLicense(license);
    }
    
    const closeDetails = () => {
        setSelectedLicense(null);
    }

    return (
        <div style={{ padding: '20px' }}>
            {/* Modal Chi tiết */}
            <LicenseDetailModal license={selectedLicense} onClose={closeDetails} />

            {/* Form Nộp Hồ Sơ */}
            <div style={formContainerStyle}>
                <h2 style={{ textAlign: 'center' }}>Form Nộp Hồ Sơ Mới</h2>
                <form onSubmit={handleSubmit}>
                    <div style={inputGroupStyle}>
                        <label>Tên Công ty:</label>
                        <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={inputStyle} />
                    </div>

                    <div style={inputGroupStyle}>
                        <label>Địa chỉ Công ty:</label>
                        <input type="text" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} required style={inputStyle} />
                    </div>

                    <div style={inputGroupStyle}>
                        <label>Tải Tài liệu (Ảnh/PDF):</label>
                        {/* <input type="file" onChange={handleFileChange} required style={fileInputStyle} /> */}
                        <div style={customFileInputContainerStyle}> {/* Container mới */}
                            <input 
                                type="file" 
                                onChange={handleFileChange} 
                                required 
                                style={hiddenFileInputStyle} 
                                id="document-upload" // ID để liên kết với label
                            />
                            {/* Label giả lập nút bấm */}
                            <label htmlFor="document-upload" style={fileInputLabelStyle}>
                                Chọn Tệp
                            </label>
                            {/* Hiển thị tên tệp đã chọn */}
                            <span style={fileNameDisplayStyle}>
                                {fileName || "Chưa có tệp nào được chọn."}
                            </span>
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} style={submitButtonStyle(isSubmitting)}>
                        {isSubmitting ? 'Đang tải lên và Nộp...' : 'Nộp Hồ Sơ Lên Blockchain'}
                    </button>
                </form>
            </div>
            
            <hr style={{ margin: '30px 0' }} />

            {/* Lịch Sử Hồ Sơ */}
            <div style={historyContainerStyle}>
                <h3>Lịch Sử Hồ Sơ Đã Nộp</h3>
                {isLoadingHistory ? (
                    <p>Đang tải lịch sử hồ sơ...</p>
                ) : userLicenses.length === 0 ? (
                    <p>Chưa có hồ sơ nào được nộp từ tài khoản này.</p>
                    ) : (
                    <div style={tableWrapperStyle}>
                        <table style={tableStyle}>
                            <thead>
                                <tr style={tableHeaderStyle}>
                                    <th>ID</th>
                                    <th>Tên Công ty</th>
                                    <th>Trạng thái</th>
                                    <th>Người Duyệt</th>
                                    <th>Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userLicenses.map((license) => (
                                    <tr key={license.id} style={tableRowStyle}>
                                        <td>{license.id}</td>
                                        <td>{license.companyName}</td>
                                        <td style={{ color: license.status === 'ĐÃ DUYỆT' ? 'green' : license.status === 'BỊ TỪ CHỐI' ? 'red' : 'orange', fontWeight: 'bold' }}>
                                            {license.status}
                                        </td>
                                        <td>{license.reviewer !== '0x0000000000000000000000000000000000000000' ? license.reviewer.substring(0, 8) + '...' : 'N/A'}</td>
                                        <td>
                                            <button onClick={() => showDetails(license)} style={detailButtonStyle}>Xem</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>     
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubmitLicenseForm;

// ---------- THEME COLORS ----------
const ACCENT = '#007BFF';      // primary accent
const CARD_BG = '#1f1f23';     // card background (dark)
const PAGE_BG = '#17171a';     // page background
const TEXT = '#E6E6E9';        // main text
const MUTED = '#A6A6AA';       // muted text
const SUCCESS = '#28a745';
const DANGER = '#dc3545';
const WARNING = '#ffc107';

// ---------- LAYOUT ----------
const pagePadding = { padding: '20px', maxWidth: '1100px', margin: '0 auto' };

// Form Card
const formContainerStyle = {
    maxWidth: '800px',
    width: '900px',
    margin: '20px auto',
    padding: '24px',
    background: CARD_BG,
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.03)',
    boxShadow: '0 8px 30px rgba(2,6,23,0.6)',
    boxSizing: 'border-box',
    color: TEXT,
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
    
};

// Input group
const inputGroupStyle = {
  marginBottom: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
};

const labelStyle = {
  color: MUTED,
  fontSize: '13px',
  fontWeight: 600
};

// Inputs
const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.04)',
  background: 'rgb(51 55 64)',
  color: TEXT,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'box-shadow 160ms ease, border-color 160ms ease',
  fontSize: '14px'
};
const inputFocus = {
  boxShadow: `0 6px 18px ${ACCENT}33`,
  borderColor: ACCENT
};

// File input (wrapper)
const fileInputStyle = {
    display: 'block',
    width: '100%',
    padding: '10px',
    borderRadius: '10px',
    border: '1px dashed rgba(255,255,255,0.04)',
    boxSizing: 'border-box',
    background: '#0f1112',
    color: MUTED,
    fontSize: '14px'
    
};

// Primary submit button
const submitButtonStyle = (loading) => ({
    marginTop: '20px',
    padding: '12px 18px',
    backgroundColor: loading ? '#5a5f65' : ACCENT,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: loading ? 'not-allowed' : 'pointer',
    width: '100%',
    fontWeight: 700,
    fontSize: '15px',
    boxShadow: loading ? 'none' : '0 8px 24px rgba(0,123,255,0.18)',
    transition: 'transform 120ms ease, box-shadow 120ms ease',
    transform: 'translateZ(0)'
});

// History Card
const historyContainerStyle = {
    maxWidth: '960px',
    margin: '28px auto',
    padding: '18px',
    background: CARD_BG,
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.03)',
    boxShadow: '0 8px 30px rgba(2,6,23,0.6)',
    color: TEXT,
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
    fontSize: '19px'
};

// Table
const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '12px',
    fontSize: '17px',
    color: TEXT,
    lineHeight: 3.2
  
};

const tableHeaderStyle = {
  backgroundColor: 'rgba(37, 38, 71, 1)',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  textAlign: 'left',
  fontSize: '17px',
  color: MUTED,
  position: 'sticky', // note: needs CSS rule to work reliably
  top: 0
};

const tableRowStyle = {
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  transition: 'background-color 150ms ease, transform 100ms ease',
  cursor: 'default'
};

const tableWrapperStyle = {
     /* Giới hạn chiều cao: 3 hàng * ~50px/hàng = 150px.
       Điều chỉnh số này nếu padding/font-size thay đổi. */
    maxHeight: '300px', 
    overflowY: 'auto', /* Bật thanh cuộn dọc khi nội dung vượt quá */
    // border: '1px solid #dee2e6', /* Thêm border để phân định khu vực cuộn */
    borderRadius:'8px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)', /* Giữ lại shadow */
    marginTop: '15px', /* Giữ margin giống như .admin-table cũ */
    padding: '10px',
    
};

const tableCellStyle = {
  padding: '12px 10px',
  verticalAlign: 'middle'
};

// Action / detail button
const detailButtonStyle = {
  padding: '6px 10px',
  backgroundColor: '#1061bdff',
  color: '#fff',
  border: 'none',
  borderRadius: '50px',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'transform 120ms ease'
};

// IPFS link
const linkStyle = {
  display: 'inline-flex',
  gap: '8px',
  alignItems: 'center',
  marginTop: '10px',
  padding: '8px 12px',
  backgroundColor: WARNING,
  color: '#222',
  borderRadius: '10px',
  textDecoration: 'none',
  fontWeight: 700,
  boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
};

// Modal Styles
const modalOverlayStyle = {
    
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(18, 24, 55, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: '20px'
};

const modalContentStyle = {
    border: '12px solid rgba(255,255,255,0.05)',
    backgroundColor: '#233444ff',
    padding: '29px',
    borderRadius: '12px',
    maxWidth: '560px',
    width: '100%',
    position: 'relative',
    boxShadow: '0 18px 50px rgba(2,6,23,0.8)',
    color: TEXT
};

const closeButtonStyle = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  border: 'none',
  background: 'transparent',
  fontSize: '22px',
  cursor: 'pointer',
  color: '#ddd',
  lineHeight: 1
};

// status color helper (use inline where needed)
const statusColor = (status) => {
  if (!status) return MUTED;
  if (status.includes('DUYỆT')) return SUCCESS;
  if (status.includes('TỪ CHỐI') || status.includes('REJECT')) return DANGER;
  return WARNING;
};

// Styles MỚI cho Custom File Input
const customFileInputContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    
    borderRadius: '10px', 
    padding: '5px',
    backgroundColor: 'rgb(51 55 64)',
};

const hiddenFileInputStyle = {
    // Ẩn input gốc
    opacity: 0,
    width: '0.1px',
    height: '0.1px',
    position: 'absolute',
    overflow: 'hidden',
    zIndex: '-1',
};

const fileInputLabelStyle = {
    // Nút chọn tệp
    backgroundColor: '#007bff',
    color: 'white',
    padding: '8px 15px',
    borderRadius: '50px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)' // Thêm bóng cho nút
};

const fileNameDisplayStyle = {
    // Hiển thị tên tệp
    marginLeft: '10px',
    padding: '5px',
    color: '#ae9c9cff',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    flexGrow: 1,
};