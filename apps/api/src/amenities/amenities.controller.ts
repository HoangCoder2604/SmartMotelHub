import { Controller, Get, Header } from "@nestjs/common";
import { AmenitiesService } from "./amenities.service.js";

@Controller("amenities")
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get()
  @Header("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600")
  async list() {
    const amenities = await this.amenitiesService.list();
    return { success: true, data: { amenities } };
  }
}
