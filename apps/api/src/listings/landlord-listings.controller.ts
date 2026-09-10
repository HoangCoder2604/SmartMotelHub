import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { CreateListingDto } from "./dto/create-listing.dto.js";
import { UpdateListingDto } from "./dto/update-listing.dto.js";
import { ListingsService } from "./listings.service.js";

type UploadedImage = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Controller("landlord/listings")
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard, VerifiedEmailGuard)
export class LandlordListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get("mine")
  async mine(@CurrentUser() user: User) {
    const listings = await this.listingsService.listMine(user.id);
    return { success: true, data: { listings } };
  }

  @Post("room/:roomId")
  async create(@CurrentUser() user: User, @Param("roomId") roomId: string, @Body() dto: CreateListingDto) {
    const listing = await this.listingsService.create(roomId, user.id, dto);
    return { success: true, data: { listing } };
  }

  @Patch(":id")
  async update(@CurrentUser() user: User, @Param("id") id: string, @Body() dto: UpdateListingDto) {
    const listing = await this.listingsService.update(id, user.id, dto);
    return { success: true, data: { listing } };
  }

  @Post(":id/submit")
  async submit(@CurrentUser() user: User, @Param("id") id: string) {
    const listing = await this.listingsService.submit(id, user.id);
    return { success: true, data: { listing } };
  }

  @Post(":id/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async uploadImage(@CurrentUser() user: User, @Param("id") id: string, @UploadedFile() file?: UploadedImage) {
    const image = await this.listingsService.uploadImage(id, user.id, file);
    return { success: true, data: { image } };
  }

  @Delete(":id/images/:imageId")
  async deleteImage(@CurrentUser() user: User, @Param("id") id: string, @Param("imageId") imageId: string) {
    const result = await this.listingsService.deleteImage(id, imageId, user.id);
    return { success: true, data: result };
  }
}
