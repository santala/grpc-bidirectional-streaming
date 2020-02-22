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

function getContent(call, callback) {
    createResponse(call.request.uri).then(response => {
        callback(null, response);
    });
}

function streamContent(call) {
    let shouldEnd = false;
    let requestsInProgress = 0;

    call.on("data", async (req) => {
        requestsInProgress++;
        call.write(await createResponse(req.uri));
        requestsInProgress--;

        if (shouldEnd && requestsInProgress == 0) {
            call.end();
        }
    });

    call.on("end", () => {
        // Close the connection from server-side only after all the results have been sent
        shouldEnd = true;
    });
}

server.addService(uriFetch.URIFetch.service, {
    getContent: getContent,
    streamContent: streamContent
});
server.start();

module.exports = server;