import { Controller, Get } from "@nestjs/common";
import { AmenitiesService } from "./amenities.service.js";

@Controller("amenities")
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get()
  async list() {
    const amenities = await this.amenitiesService.list();
    return { success: true, data: { amenities } };
  }
}
