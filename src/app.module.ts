import { Module } from '@nestjs/common'
import {TelegrafModule} from "nestjs-telegraf";
import {ProviderModule} from "./provider/provider.module";
import {MyTelegrafModule} from "./telegraf.module";
import * as process from "process";
@Module({
  imports: [
    ProviderModule,
    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_BOT_KEY,
      launchOptions: {
        dropPendingUpdates: true
      }
    }),
    MyTelegrafModule
  ],
})
export class AppModule {}
