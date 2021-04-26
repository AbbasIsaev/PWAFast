const webPush = require('web-push')
const path = require("path")
const fs = require("fs")

const vapidKeysPath = path.join(__dirname, 'config', 'vapidKeys.json')

let PUBLIC_KEY, PRIVATE_KEY

if (fs.existsSync(vapidKeysPath)) {
    const vapidKeys = fs.readFileSync(vapidKeysPath).toString()
    const {publicKey, privateKey} = JSON.parse(vapidKeys)
    PUBLIC_KEY = publicKey
    PRIVATE_KEY = privateKey
}

if (process.env.WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PUBLIC_KEY) {
    PUBLIC_KEY = process.env.WEB_PUSH_VAPID_PUBLIC_KEY
    PRIVATE_KEY = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
}

// Подписки пользователей
const subscriptions = {}

module.exports = function (app, route) {
    app.get(route + 'public_key', function (req, res) {
        res.send({PUBLIC_KEY: PUBLIC_KEY})
    })

    app.get(route + 'subscriptions', function (req, res) {
        res.send(subscriptions)
    })

    app.post(route + 'subscriptions', function (req, res) {
        const {subscription} = req.body
        try {
            const subscriptionJson = JSON.parse(subscription)

            subscriptions[subscriptionJson.endpoint] = subscriptionJson
            res.sendStatus(201)
        } catch (error) {
            res.status(500).json({message: 'Неверный формат подписки'})
            console.log(error)
        }
    })

    app.delete(route + 'subscriptions', function (req, res) {
        const {subscription} = req.body
        try {
            const subscriptionJson = JSON.parse(subscription)

            delete subscriptions[subscriptionJson.endpoint]
            res.sendStatus(200)
        } catch (error) {
            res.status(500).json({message: 'Неверный формат подписки'})
            console.log(error)
        }
    })

    app.post(route + 'send_notification', function (req, res) {
        const {subscription, payload, ttl} = req.body
        const options = {
            // Время жизни push сообщения, в секундах
            TTL: ttl
        }

        try {
            const subscriptionJson = JSON.parse(subscription)

            webPush.sendNotification(subscriptionJson, payload, options)
                .then(function () {
                    res.sendStatus(201)
                })
                .catch(function (error) {
                    res.status(500).json({message: 'Ошибка при отправке уведомления'})
                    console.log(error)
                })
        } catch (error) {
            res.status(500).json({message: 'Неверный формат подписки'})
            console.log(error)
        }
    })

    app.post(route + 'send_notification_all', function (req, res) {
        const {payload, ttl} = req.body
        const options = {
            // Время жизни push сообщения, в секундах
            TTL: ttl
        }

        for (const key in subscriptions) {
            webPush.sendNotification(subscriptions[key], payload, options)
                .catch(function (error) {
                    console.log(key, error)
                })
        }
        res.sendStatus(201)
    })
}

if (!PUBLIC_KEY || !PRIVATE_KEY) {
    throw new Error(
        'Вы должны установить переменные среды WEB_PUSH_VAPID_PUBLIC_KEY и WEB_PUSH_VAPID_PRIVATE_KEY. '+
        `Вы можете использовать следующие: \n${ JSON.stringify(webPush.generateVAPIDKeys(), null, 2)}`
    )
}

webPush.setVapidDetails(
    'http://localhost/',
    PUBLIC_KEY,
    PRIVATE_KEY
)