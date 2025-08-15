import { NextFunction, Request, Response } from "express";
import { prismaClient } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse, ApiError } from "../utils/apiHandlerHelpers";
import { AuthRequest } from "../middlewares/authMiddleware";
import { sendGlobalNotification } from "../utils/notify";
import ExcelJS from "exceljs";
// ➤ Add a travel entry
export const addTravel = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { fromAirportId, toAirportId, travelDate, travelTime } = req.body;
    const userId = req.user?.userId;

    if (
      !userId ||
      !fromAirportId ||
      !toAirportId ||
      !travelDate ||
      !travelTime
    ) {
      throw new ApiError(400, "All fields are required.");
    }

    // Validate airports exist
    const [fromAirport, toAirport] = await Promise.all([
      prismaClient.airport.findUnique({ where: { id: fromAirportId } }),
      prismaClient.airport.findUnique({ where: { id: toAirportId } }),
    ]);

    if (!fromAirport || !toAirport) {
      throw new ApiError(400, "Invalid airport selection");
    }

    const travel = await prismaClient.travel.create({
      data: {
        userId,
        fromAirportId,
        toAirportId,
        travelDate: new Date(travelDate),
        travelTime,
        status: "AVAILABLE",
      },
      include: {
        fromAirport: true,
        toAirport: true,
        user: { select: { name: true, email: true } },
      },
    });
    await sendGlobalNotification({
      title: "Hey KMCC Members!",
      body: "Check out the latest travel update!",
      data: { type: "news", travelId: travel.id.toString() },
    });

    res
      .status(201)
      .json(new ApiResponse(201, travel, "Travel details added successfully"));
  }
);

// ➤ Get all travel records
export const getAllTravels = asyncHandler(
  async (req: Request, res: Response) => {
    const travels = await prismaClient.travel.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phoneNumber: true,
            areaName: true,
          },
        },
        fromAirport: true,
        toAirport: true,
      },
      orderBy: { travelDate: "desc" },
    });

    res
      .status(200)
      .json(
        new ApiResponse(200, travels, "Travel data retrieved successfully")
      );
  }
);
/**
 * @desc    Get upcoming travels (after current time) with pagination
 * @route   GET /api/travel/upcoming
 * @access  Private
 */
export const getUpcomingTravels = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const currentDate = new Date();
    const userId = req.user?.userId;

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Count total upcoming travels for pagination metadata
    const totalTravels = await prismaClient.travel.count({
      where: {
        travelDate: {
          gte: currentDate,
        },
      },
    });

    const travels = await prismaClient.travel.findMany({
      where: {
        travelDate: {
          gte: currentDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            memberId: true,
          },
        },
        fromAirport: true,
        toAirport: true,
      },
      orderBy: {
        travelDate: "asc",
      },
      skip,
      take: limit,
    });

    // Add isAccessed field if user is the creator
    const travelsWithAccess = travels.map((travel:any) => ({
      ...travel,
      isAccessed: travel.user.id === userId,
    }));

    // Pagination metadata
    const pagination = {
      total: totalTravels,
      totalPages: Math.ceil(totalTravels / limit),
      currentPage: page,
      hasNextPage: page * limit < totalTravels,
      hasPreviousPage: page > 1,
    };

    res.status(200).json(
      new ApiResponse(
        200,
        {
          travels: travelsWithAccess,
          pagination,
        },
        "Upcoming travels fetched successfully"
      )
    );
  }
);
// ➤ Update travel record (full update)
export const updateTravel = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { fromAirportId, toAirportId, travelDate, travelTime, status } =
      req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    // Validate required fields
    if (
      !fromAirportId ||
      !toAirportId ||
      !travelDate ||
      !travelTime ||
      !status
    ) {
      throw new ApiError(400, "All fields are required.");
    }

    if (!["AVAILABLE", "ONBOARD", "NOT_AVAILABLE"].includes(status)) {
      throw new ApiError(400, "Invalid status provided");
    }

    // Check if travel record exists
    const travel = await prismaClient.travel.findUnique({
      where: { id: Number(id) },
    });

    if (!travel) {
      throw new ApiError(404, "Travel record not found");
    }

    // Validate airports exist
    const [fromAirport, toAirport] = await Promise.all([
      prismaClient.airport.findUnique({ where: { id: fromAirportId } }),
      prismaClient.airport.findUnique({ where: { id: toAirportId } }),
    ]);

    if (!fromAirport || !toAirport) {
      throw new ApiError(400, "Invalid airport selection");
    }

    // Update travel record
    const updatedTravel = await prismaClient.travel.update({
      where: { id: Number(id) },
      data: {
        fromAirportId,
        toAirportId,
        travelDate: new Date(travelDate),
        travelTime,
        status,
      },
      include: {
        fromAirport: true,
        toAirport: true,
        user: { select: { name: true } },
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedTravel,
          "Travel record updated successfully"
        )
      );
  }
);

export const deleteTravel = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    const isAdmin = req.user?.isAdmin; // Assuming your auth middleware adds isAdmin

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    // Find the travel record
    const travel = await prismaClient.travel.findUnique({
      where: { id: Number(id) },
    });

    if (!travel) {
      throw new ApiError(404, "Travel record not found");
    }

    // Check if the user is the owner or an admin
    if (travel.userId !== userId && !isAdmin) {
      throw new ApiError(
        403,
        "You are not authorized to delete this travel record"
      );
    }

    // Delete travel record
    await prismaClient.travel.delete({
      where: { id: Number(id) },
    });

    res
      .status(200)
      .json(new ApiResponse(200, {}, "Travel record deleted successfully"));
  }
);

// ➤ Get all airports
export const getAirports = asyncHandler(async (req: Request, res: Response) => {
  const airports = await prismaClient.airport.findMany({
    orderBy: { name: "asc" },
  });

  res
    .status(200)
    .json(new ApiResponse(200, airports, "Airports retrieved successfully"));
});

export const exportTravelsToExcel = asyncHandler(
  async (req: Request, res: Response) => {
    // Get all travel records with related data
    const travels = await prismaClient.travel.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phoneNumber: true,
            memberId: true,
            areaName: true,
          },
        },
        fromAirport: true,
        toAirport: true,
      },
      orderBy: { travelDate: "desc" },
    });

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Travel Records");

    // Add headers
    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Member ID", key: "memberId", width: 15 },
      { header: "Traveler Name", key: "travelerName", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 20 },
      { header: "Area", key: "area", width: 20 },
      { header: "From Airport", key: "fromAirport", width: 25 },
      { header: "To Airport", key: "toAirport", width: 25 },
      { header: "Travel Date", key: "travelDate", width: 15 },
      { header: "Travel Time", key: "travelTime", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    // Add data rows
    travels.forEach((travel:any) => {
      worksheet.addRow({
        id: travel.id,
        memberId: travel.user.memberId,
        travelerName: travel.user.name,
        email: travel.user.email,
        phone: travel.user.phoneNumber,
        area: travel.user.areaName,
        fromAirport: travel.fromAirport.name,
        toAirport: travel.toAirport.name,
        travelDate: travel.travelDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        travelTime: travel.travelTime,
        status: travel.status,
        createdAt: travel.createdAt.toISOString(),
      });
    });

    // Style the header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Set response headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=travel_records.xlsx"
    );

    // Write the workbook to the response
    await workbook.xlsx.write(res);
    res.end();
  }
);