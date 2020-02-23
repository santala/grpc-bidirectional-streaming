const config = require("./config");

const fetch = require("node-fetch");

const PROTO_PATH = __dirname + "/urifetch.proto";
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");

const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    }
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const uriFetch = protoDescriptor.urifetch;


// SERVICE INTERFACE

const server = new grpc.Server();
server.bind("0.0.0.0:"+config.port, grpc.ServerCredentials.createInsecure());

async function createResponse(uri) {
    try {
        const res = await fetch(uri);
        const body = await res.text();
        return {
            uri: uri,
            status: res.status,
            content: body
        };
    } catch (e) {
        console.log(e);
        return {
            uri: uri,
            status: 500
        };
    }
}

function streamContent(call) {
    let endReceived = false;
    let requestsInProgress = 0;
    // Close the connection from server-side only after all the results have been sent
    const tryEnd = () => {
        if (endReceived && requestsInProgress === 0) {
            call.end();
        }
    };

    call.on("data", (request) => {
        requestsInProgress++;
        createResponse(request.uri).then(response => {
            call.write(response);
            requestsInProgress--;
            tryEnd();
        });
    });

    call.on("end", () => {
        endReceived = true;
        tryEnd();
    });
}

server.addService(uriFetch.URIFetch.service, {
    streamContent: streamContent
});
server.start();

module.exports = server;