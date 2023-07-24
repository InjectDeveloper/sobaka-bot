import {Action, Command, Ctx, Hears, InjectBot, On, Start, Update} from "nestjs-telegraf";
import {Context, Telegraf} from "telegraf";
import {PrismaService} from "./provider/database/prisma/provider.service";
import * as QuickChart from 'quickchart-js'

@Update()
export class AppUpdate {
    constructor(
        private readonly prismaService: PrismaService,
        @InjectBot() private bot: Telegraf<Context>
    ) {
        bot.telegram.setMyCommands([
            {
                command: '/start',
                description: 'Перезапуск бота'
            },
            {
                command: '/stat',
                description: 'Общая статистика'
            },
            {
                command: '/me',
                description: 'Статистика игрока'
            },
        ])
    }

    @Start()
    async start(@Ctx() ctx: Context) {
        if (!ctx.from.username) {
            await ctx.replyWithHTML('Для пользования ботом нужен юзернейм')
            return
        }
        const user = await this.prismaService.user.findUnique({
            where: {
                id: ctx.from.id.toString()
            }
        })
        if (!user) {
            await this.prismaService.user.create({
                data: {
                    id: ctx.from.id.toString(),
                    username: ctx.from.username
                }
            })
        } else if (user.username != ctx.from.username) {
            await this.prismaService.user.update({
                where: {
                    id: ctx.from.id.toString()
                },
                data: {
                    username: ctx.from.username
                }
            })
        }

        await ctx.reply('Ку, отправь фото собаки и подпиши "собака" и кол-во собак на фото\nПример "Собака 10"\n\nОбщаяя стата - /stat\nЛичная стата - /me');
    }

    @Command('stat')
    async stat(@Ctx() ctx: Context) {
        const allImages = await this.prismaService.dog.findMany()
        let dogs = 0
        let approvedImages = 0
        let disapprovedImages = 0
        for (let i = 0; i < allImages.length; i++) {
            const image = allImages[i]
            if (image.isApproved) {
                dogs += image.amount
                approvedImages += 1
            } else {
                disapprovedImages += 1
            }
        }

        let toper = ``
        let toperCount = 0
        let lier = `` as any
        let lies = 0
        const users = await this.prismaService.user.findMany()

        let labels = []
        let datasets = [
            { label: 'Кол-во фотографий', data: [], backgroundColor: '#cfcfcf'},
            { label: 'Кол-во собак', data: [], backgroundColor: '#017d01'}
        ]
        for (let i = 0; i < users.length; i++) {
            labels.push(users[i].username)
            const userLies = await this.prismaService.dog.findMany({
                where: {
                    userId: users[i].id,
                    isApproved: false
                }
            })
            if (userLies.length > lies) {
                lier = users[i].username
                lies = userLies.length
            }

            const userTrues = await this.prismaService.dog.findMany({
                where: {
                    userId: users[i].id,
                    isApproved: true
                }
            })
            let tr = 0
            for (let j = 0; j < userTrues.length; j++) {
                tr += userTrues[j].amount
            }
            if (tr > toperCount) {
                toper = users[i].username
                toperCount = tr
            }

            datasets[0].data.push(userLies.length + userTrues.length)
            datasets[1].data.push(tr)
        }

        // @ts-ignore
        const myChart = new QuickChart()
        myChart.setConfig({
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets,
            },
            options: {
                legend: {
                    labels: {
                        fontSize: 12,
                        fontStyle: 'normal',
                        fontColor: '#f5f5f5',
                    }
                },
                title: {
                    display: true,
                    text: 'Общая статистика',
                    fontSize: 20,
                    fontColor: '#ffffff',
                },
                scales: {
                    yAxes: [
                        {
                            ticks: {
                                beginAtZero: true,
                                fontColor: '#f5f5f5',
                            },
                        },
                    ],
                    xAxes: [
                        {
                            ticks: {
                                fontFamily: 'Serif',
                                fontStyle: 'Mono',
                                fontColor: '#f5f5f5',
                            },
                        },
                    ],
                },
            }
        })
        myChart.setBackgroundColor('#1c1c1c')
        console.log(myChart.getUrl())
        let text = `Общая статистика`
        text += `\n\n`
        text += `Всего фотографий - <b>${allImages.length}</b>\n`
        text += `Всего принятых фотографий - <b>${approvedImages}</b>\n`
        text += `Всего отклонённых фотографий - <b>${disapprovedImages}</b>\n`
        text += `Всего собак - <b>${dogs}</b>\n\n`
        text += `<b>ЛУЧШИЙ НА ДАННЫЙ МОМЕНТ - ${toper}, он скинул ${toperCount} шт. собак</b>\n\n`
        text += `Главный врун - ${lier}, на его счету - ${lies} отклонённых фотографий.`
        await ctx.sendPhoto(myChart.getUrl(), {
            caption: text,
            parse_mode: 'HTML'
        })
    }

    @Command('me')
    async me(@Ctx() ctx: Context) {
        const allImages = await this.prismaService.dog.findMany({
            where: {
                userId: ctx.from.id.toString()
            }
        })
        let dogs = 0
        let approvedImages = 0
        let disapprovedImages = 0
        for (let i = 0; i < allImages.length; i++) {
            const image = allImages[i]
            if (image.isApproved) {
                dogs += image.amount
                approvedImages += 1
            } else {
                disapprovedImages += 1
            }
        }

        let text = `Игрок - ${ctx.from.username}`
        text += `\n\n`
        text += `Всего фотографий - <b>${allImages.length}</b>\n`
        text += `Всего принятых фотографий - <b>${approvedImages}</b>\n`
        text += `Всего отклонённых фотографий - <b>${disapprovedImages}</b>\n`
        text += `Всего собак - <b>${dogs}</b>\n\n`
        await ctx.replyWithHTML(text, {
            parse_mode: 'HTML'
        })
    }

    @On('photo')
    async photo(@Ctx() ctx: Context) {
        // @ts-ignore
        const caption = await ctx.message.caption as string
        if (!caption || !caption.match(/[С-с]обака [0-9]*[.,]?[0-9]/)) {
            return
        }

        // @ts-ignore
        const image = ctx.message.photo[ctx.message.photo.length - 1] as any

        const dog = await this.prismaService.dog.create({
            data: {
                userId: ctx.from.id.toString(),
                fileId: image.file_id,
                amount: Number(caption.split(' ')[1])
            }
        })
        await ctx.sendPhoto(dog.fileId, {
            caption: `❓ Это реально собака? И их реально ${caption.split(' ')[1]} штук? ❓`,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: `✅ Да`,
                            callback_data: `${dog.id}_approve`
                        },
                        {
                            text: `❌ Нет`,
                            callback_data: `${dog.id}_disapprove`
                        }
                    ]
                ]
            }
        })
    }

    @Action(/.*/)
    async callback(@Ctx() ctx: Context) {
        // @ts-ignore
        const callback = ctx.callbackQuery.data as string
        const dogId = callback.split('_')[0]
        const dog = await this.prismaService.dog.findUnique({
            where: {
                id: Number(dogId)
            }
        })
        if (dog.userId == ctx.from.id.toString()) {
            await ctx.answerCbQuery(`Нельзя проголосовать за свою собаку!`, {
                show_alert: true
            })
            return
        }
        await ctx.answerCbQuery()
        if (callback.split('_')[1] == 'approve') {
            await this.prismaService.dog.update({
                where: {
                    id: Number(dogId)
                },
                data: {
                    isApproved: true
                }
            })
            await ctx.editMessageCaption('<b>✅ Собака подтверждена</b>', {
                reply_markup: undefined,
                parse_mode: 'HTML'
            })
        } else {
            await ctx.editMessageCaption('<b>❌ Это не собака!</b>', {
                reply_markup: undefined,
                parse_mode: 'HTML'
            })
        }
    }
}
