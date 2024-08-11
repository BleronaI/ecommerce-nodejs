let io;

module.exports = { 
    init: httpServer => {
       io = require("socket.io")(httpServer, 
        {
            cors: {
                origin: '*',
                methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
                allowedHeaders: ['Content-Type', 'Authorization']
              }
        }
       );
       return io;
    },
    getIO: () => {
        if(!io) {
            throw new Error('Socket.io no initialized!')
        }
        return io;
    }
}