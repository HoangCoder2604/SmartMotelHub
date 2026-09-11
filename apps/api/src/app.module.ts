import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module.js";
import { AmenitiesModule } from "./amenities/amenities.module.js";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { AppController } from "./app.controller.js";
import { AppointmentsModule } from "./appointments/appointments.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ComplaintsModule } from "./complaints/complaints.module.js";
import { ContractsModule } from "./contracts/contracts.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { FavoritesModule } from "./favorites/favorites.module.js";
import { InvoicesModule } from "./invoices/invoices.module.js";
import { ListingsModule } from "./listings/listings.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PropertiesModule } from "./properties/properties.module.js";
import { ReviewsModule } from "./reviews/reviews.module.js";
import { RoomsModule } from "./rooms/rooms.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    AmenitiesModule,
    PropertiesModule,
    RoomsModule,
    ListingsModule,
    FavoritesModule,
    AppointmentsModule,
    ReviewsModule,
    NotificationsModule,
    ContractsModule,
    InvoicesModule,
    ComplaintsModule,
    AdminModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
