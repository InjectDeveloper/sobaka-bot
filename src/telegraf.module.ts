import {Module} from "@nestjs/common";
import {AppUpdate} from "./app.update";

@Module({
    providers: [AppUpdate],
    exports: [AppUpdate]
})
export class MyTelegrafModule {}