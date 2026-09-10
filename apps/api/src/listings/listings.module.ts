import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { LandlordListingsController } from "./landlord-listings.controller.js";
import { ListingImagesController } from "./listing-images.controller.js";
import { ListingsService } from "./listings.service.js";
import { PublicListingsController } from "./public-listings.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [PublicListingsController, LandlordListingsController, ListingImagesController],
  providers: [ListingsService],
})
export class ListingsModule {}
