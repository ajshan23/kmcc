"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jobController_1 = require("../controllers/jobController");
const adminController_1 = require("../controllers/adminController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// ✅ Create a new job (Admin Only)
router.post("/create", authMiddleware_1.authenticateUser, adminController_1.upload.single("logo"), jobController_1.createJob);
// ✅ Edit an existing job (Admin Only)
router.put("/:jobId", authMiddleware_1.authenticateUser, adminController_1.upload.single("logo"), jobController_1.editJob);
// ✅ Delete a job (Admin Only)
router.delete("/:jobId", authMiddleware_1.authenticateUser, jobController_1.deleteJob);
// ✅ Get all active jobs (Public)
router.get("/", jobController_1.getActiveJobs);
// ✅ Get a single job by ID (Public or Private with user context)
router.get("/:jobId", jobController_1.getJobById);
router.get("/:jobId/new", authMiddleware_1.authenticateUser, jobController_1.getJobByIdNew);
// ✅ Get all jobs (Admin only)
router.get("/admin/all", authMiddleware_1.authenticateUser, jobController_1.getAllJobsAdmin);
// ✅ Apply for a job (User - authenticated only)
router.post("/apply-new", authMiddleware_1.authenticateUser, adminController_1.upload.single("resume"), jobController_1.applyJobNew);
router.post("/apply", adminController_1.upload.single("resume"), jobController_1.applyJob);
// For admin to get all job application for a particular job
router.get("/get-applications/:jobId", authMiddleware_1.authenticateUser, jobController_1.getJobApplications);
// Close a job for admin
router.patch("/:jobId/close", authMiddleware_1.authenticateUser, jobController_1.closeJob);
exports.default = router;
