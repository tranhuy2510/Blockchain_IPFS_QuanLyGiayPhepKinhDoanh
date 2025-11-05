require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require('dotenv').config(); // Nếu bạn muốn dùng biến môi trường

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28", // Hoặc phiên bản phù hợp
  networks: {
    hardhat: {
      // Cấu hình mạng Hardhat mặc định (chạy npx hardhat node)
      chainId: 31337 // ChainID mặc định của Hardhat local
    },
    // Thêm cấu hình cho mạng local
    localhost: {
      url: "http://127.0.0.1:8545", // Địa chỉ mặc định khi chạy npx hardhat node
      accounts: [process.env.PRIVATE_KEY], // Nếu muốn sử dụng private key cụ thể
      chainId: 31337 // ChainID phải trùng với ChainID bạn cấu hình trong Metamask
    }
  }
};