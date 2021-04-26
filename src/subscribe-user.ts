const HOST_API_PUSH = 'http://localhost:3030/api/web_push'
let pushButton: HTMLButtonElement | null = null
let isSubscribed = false

type TPushKey = {
    PUBLIC_KEY: string
}

function urlB64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

function updateBtn() {
    if (Notification.permission === 'denied') {
        pushButton!.textContent = 'Push-сообщения заблокированы.'
        pushButton!.disabled = true
        return
    }

    if (isSubscribed) {
        pushButton!.textContent = 'Отключить push-сообщения'
    } else {
        pushButton!.textContent = 'Включить push-сообщения'
    }

    pushButton!.disabled = false
}

function updateSubscriptionOnServer(subscription: PushSubscription) {
    // Сохраняем подписку на бэкенде
    const data = {subscription: JSON.stringify(subscription)}

    fetch(HOST_API_PUSH + '/subscriptions',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }
    ).then()
}

function subscribeUser(registration: ServiceWorkerRegistration, publicKey: string) {
    const applicationServerKey = urlB64ToUint8Array(publicKey)
    registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
    })
        .then(function (subscription) {
            console.log('Пользователь подписан.')
            updateSubscriptionOnServer(subscription)
            isSubscribed = true
            updateBtn()
        })
        .catch(function (err) {
            console.log('Не удалось подписаться на пользователя: ', err)
            updateBtn()
        })
}

function unsubscribeUser(registration: ServiceWorkerRegistration) {
    registration.pushManager.getSubscription()
        .then(function (subscription) {
            if (subscription) {
                // Удаляем подписку на бэкенде
                const data = {subscription: JSON.stringify(subscription)}

                fetch(HOST_API_PUSH + '/subscriptions',
                    {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    }
                ).then()
                return subscription.unsubscribe()
            }
        })
        .catch(function (error) {
            console.log('Error unsubscribing', error)
        })
        .then(function () {
            console.log('Пользователь отказался от подписки.')
            isSubscribed = false
            updateBtn()
        })
}

export function subscribeMain(registration: ServiceWorkerRegistration) {
    pushButton = document.querySelector('#subscribe-user')
    pushButton!.addEventListener('click', function () {
        pushButton!.disabled = true
        if (isSubscribed) {
            unsubscribeUser(registration)
        } else {
            fetch(HOST_API_PUSH + '/public_key').then(res => res.json())
                .then((key: TPushKey) => {
                    subscribeUser(registration, key.PUBLIC_KEY)
                })
        }
    })

    // Set the initial subscription value
    registration.pushManager.getSubscription()
        .then(function (subscription) {
            isSubscribed = subscription !== null

            if (isSubscribed) {
                subscription && updateSubscriptionOnServer(subscription)
                console.log('Пользователь подписан.')
            } else {
                console.log('Пользователь не подписан.')
            }
            updateBtn()
        })
}