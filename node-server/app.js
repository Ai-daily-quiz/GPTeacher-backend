const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
const FormData = require("form-data");
const { PYTHON_API_URL } = require("./config");

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 },
});

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 라우트 정의
app.get("/", (req, res) => {
  res.json({
    message: "Node.js server is running!",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/quiz/count-pending", async (req, res) => {
  try {
    const response = await axios.get(
      `${PYTHON_API_URL}/api/quiz/count-pending`,
      {
        headers: req.headers,
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/quiz/count-incorrect", async (req, res) => {
  try {
    const response = await axios.get(
      `${PYTHON_API_URL}/api/quiz/count-incorrect`,
      {
        headers: req.headers,
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/quiz/count-free", async (req, res) => {
  try {
    const response = await axios.get(
      `${PYTHON_API_URL}/api/quiz/count-free`
      // {
      //   headers: req.headers,
      // }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/quiz/pending", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/api/quiz/pending`, {
      headers: req.headers,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/quiz/incorrect", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/api/quiz/incorrect`, {
      headers: req.headers,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/quiz/free", async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/api/quiz/free`, {});
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Python 서버로 텍스트 분류 요청
app.post("/api/quiz/submit", async (req, res) => {
  try {
    const response = await axios.post(
      `${PYTHON_API_URL}/api/quiz/submit`,
      req.body,
      { headers: req.headers }
    );

    console.log("Python 서버 응답:", response.data);

    // 응답을 클라이언트에게 전송
    res.json(response.data);
  } catch (error) {
    console.error("Python 서버 에러:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to analyze text",
      details: error.response?.data || error.message,
    });
  }
});

app.post(
  "/api/analyze-file",
  upload.single("uploadFile"),
  async (req, res, next) => {
    try {
      const isMember = !!req.headers.authorization;
      const uploadMBLimit = isMember ? 50 : 10;
      console.log("📁 파일 수신:", {
        name: req.file.originalname,
        size: req.file.size,
        sizeMB: (req.file.size / 1024 / 1024).toFixed(2) + "MB",
      });

      if (req.file.size > uploadMBLimit * 1024 * 1024) {
        const error = new multer.MulterError("LIMIT_FILE_SIZE");
        error.message = `파일 크기는 최대 ${uploadMBLimit}MB까지 업로드 가능합니다.`;

        fs.unlinkSync(req.file.path);
        return next(error);
      }
      console.log("🟢 파일 정보:", req.file);
      console.log("🟢 파일 정보:", req.file.size);
      const formData = new FormData();
      formData.append("file", fs.createReadStream(req.file.path));
      formData.append("filename", req.file.originalname);

      const headers = req.headers.authorization
        ? { Authorization: req.headers.authorization }
        : {};
      const response = await axios.post(
        `${PYTHON_API_URL}/api/analyze-file`,
        formData,
        {
          headers,
          timeout: 300000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      console.log("Python 서버 응답:", response.data);
      fs.unlinkSync(req.file.path);
      res.json(response.data);
    } catch (error) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      next(error);
    }
  }
);
app.post(
  "/api/analyze-file",
  upload.single("uploadFile"),
  async (req, res, next) => {
    try {
      console.log("📁 파일 정보:", {
        name: req.file.originalname,
        size: req.file.size,
        sizeMB: (req.file.size / 1024 / 1024).toFixed(2) + "MB",
      });

      const formData = new FormData();
      formData.append("file", fs.createReadStream(req.file.path));
      formData.append("filename", req.file.originalname);

      const headers = req.headers.authorization
        ? { Authorization: req.headers.authorization }
        : {};

      console.log("🚀 Python 서버로 전송 시작...");
      const startTime = Date.now();

      try {
        const response = await axios.post(
          `${PYTHON_API_URL}/api/analyze-file`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              ...headers,
            },
            timeout: 300000, // 5분
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        );

        const endTime = Date.now();
        console.log(`✅ 응답 시간: ${(endTime - startTime) / 1000}초`);

        fs.unlinkSync(req.file.path);
        res.json(response.data);
      } catch (axiosError) {
        console.error("❌ Python 서버 에러:", {
          message: axiosError.message,
          code: axiosError.code,
          response: axiosError.response?.status,
          responseData: axiosError.response?.data,
          responseText: axiosError.response?.statusText,
        });
        throw axiosError;
      }
    } catch (error) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      next(error);
    }
  }
);
app.post(
  "/api/analyze-ocr",
  upload.single("uploadFile"),
  async (req, res, next) => {
    try {
      const isMember = !!req.headers.authorization;
      const uploadMBLimit = isMember ? 50 : 10;

      if (req.file.size > uploadMBLimit * 1024 * 1024) {
        const error = new multer.MulterError("LIMIT_FILE_SIZE");
        error.message = `파일 크기는 최대 ${uploadMBLimit}MB까지 업로드 가능합니다.`;

        fs.unlinkSync(req.file.path);
        return next(error);
      }
      console.log("🟢 파일 정보:", req.file);
      console.log("🟢 파일 정보:", req.file.size);
      const formData = new FormData();
      formData.append("file", fs.createReadStream(req.file.path));
      formData.append("filename", req.file.originalname);

      const headers = req.headers.authorization
        ? { Authorization: req.headers.authorization, path: req.file.path }
        : {};
      const response = await axios.post(
        `${PYTHON_API_URL}/api/analyze-ocr`,
        formData,
        {
          headers,
        }
      );

      console.log("Python 서버 응답:", response.data);
      fs.unlinkSync(req.file.path);
      res.json(response.data);
    } catch (error) {
      // 분석 중 에러도 next 로 넘겨서 전역 에러 핸들러로
      if (req.file?.path) fs.unlinkSync(req.file.path);
      next(error);
    }
  }
);

app.post("/api/analyze", async (req, res) => {
  try {
    const { clipboard } = req.body;
    console.log("🪢 클립보드 텍스트 길이:", clipboard?.length);
    const authHeader = req.headers.authorization;
    const headers = authHeader ? { Authorization: authHeader } : {};

    const response = await axios.post(
      `${PYTHON_API_URL}/api/analyze`,
      {
        text: clipboard,
      },
      {
        headers,
      }
    );

    console.log("Python 서버 응답:", response.data);

    // 응답을 클라이언트에게 전송
    res.json(response.data);
  } catch (error) {
    console.error("Python 서버 에러:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to analyze text",
      details: error.response?.data || error.message,
    });
  }
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.log("🔴 에러:", err); // 로그 추가

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: err.message,
      });
    }
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: err.message || "서버 오류" });
});

// 404 에러 처리
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// app 내보내기
module.exports = app;
