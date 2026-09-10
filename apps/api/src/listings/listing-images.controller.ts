import { Controller, Get, Param, StreamableFile } from "@nestjs/common";
import { ListingsService } from "./listings.service.js";

@Controller("listing-images")
export class ListingImagesController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get(":filename")
  async image(@Param("filename") filename: string) {
    const result = await this.listingsService.openImage(filename);
    return new StreamableFile(result.stream, {
      type: result.contentType,
      disposition: `inline; filename="${filename}"`,
    });
  }
}
