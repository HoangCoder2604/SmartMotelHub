import { Controller, Get, Param, Query } from "@nestjs/common";
import { ListPublicListingsQueryDto } from "./dto/list-public-listings-query.dto.js";
import { ListingsService } from "./listings.service.js";

@Controller("listings")
export class PublicListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  async list(@Query() query: ListPublicListingsQueryDto) {
    return { success: true, data: await this.listingsService.listPublic(query) };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const listing = await this.listingsService.publicDetail(id);
    return { success: true, data: { listing } };
  }
}
