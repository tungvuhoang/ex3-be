const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");
require("dotenv").config();

dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB Error:", err.message));

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên không được để trống"],
      minlength: [2, "Tên phải có ít nhất 2 ký tự"],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, "Tuổi không được để trống"],
      min: [0, "Tuổi phải >= 0"],
      validate: {
        validator: Number.isInteger,
        message: "Tuổi phải là số nguyên",
      },
    },
    email: {
      type: String,
      required: [true, "Email không được để trống"],
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);

function normalizeBody(body) {
  const data = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
  if (body.address !== undefined) data.address = String(body.address).trim();
  if (body.age !== undefined && body.age !== "") data.age = Number(body.age);

  return data;
}

function buildErrorMessage(err) {
  if (err.code === 11000) return "Email đã tồn tại";
  if (err.name === "CastError") return "ID không hợp lệ";
  return err.message;
}

app.get("/", (req, res) => {
  res.json({ message: "User Management API is running" });
});

app.get("/api/users", async (req, res) => {
  try {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 5;
    const search = (req.query.search || "").trim();

    if (page < 1) page = 1;
    if (![3, 5, 10].includes(limit)) limit = 5;

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({ page, limit, total, totalPages, data: users });
  } catch (err) {
    res.status(500).json({ error: buildErrorMessage(err) });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const data = normalizeBody(req.body);

    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      return res.status(400).json({ error: "Email đã tồn tại" });
    }

    const newUser = await User.create(data);

    res.status(201).json({
      message: "Tạo người dùng thành công",
      data: newUser,
    });
  } catch (err) {
    res.status(400).json({ error: buildErrorMessage(err) });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const data = normalizeBody(req.body);

    const updatedUser = await User.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({
      message: "Cập nhật người dùng thành công",
      data: updatedUser,
    });
  } catch (err) {
    res.status(400).json({ error: buildErrorMessage(err) });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({ message: "Xóa người dùng thành công" });
  } catch (err) {
    res.status(400).json({ error: buildErrorMessage(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
