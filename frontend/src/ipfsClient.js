// frontend/src/ipfsClient.js
import { create } from 'ipfs-http-client';

// Kết nối đến node IPFS Desktop local
// LƯU Ý: Nếu gặp lỗi CORS, bạn cần cấu hình CORS trong IPFS (dùng IPFS CLI nếu cần)
// Hoặc thử dùng 'http://localhost:5001'
export const ipfsClient = create({ url: 'http://127.0.0.1:5001' });