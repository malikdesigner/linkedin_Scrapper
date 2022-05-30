const records = [{ name: 'ali', id: '423' }, { name: 'naveed', id: '1122' }];

const dbGetByIdCall = (id) => {
    return new Promise((resolve, reject) => {
        setTimeout((callId) => {
            const data = records.find(record => record.id == callId);

            if (data) {
                resolve(data);
            } else {
                reject(new Error(`Record not found against ID = ${callId}`))
            }
        }, Math.random() * 2500, id);
    });
}

const main = async () => {
    const record = await dbGetByIdCall(111);
    console.log('*****', { record })
}

main();