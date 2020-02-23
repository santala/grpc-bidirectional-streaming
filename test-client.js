const config = require("./config");

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
const client = new uriFetch.URIFetch("localhost:"+config.port, grpc.credentials.createInsecure());

const http = require("http");

http.createServer(function (request, response) {

    const url = new URL(request.url, `http://${request.headers.host}`)

    const uri = url.searchParams.get("uri") || false;

    if (!uri) {
        response.end("Hello World!");
    } else {
        const call = client.streamContent();
        call.on("error", (err) => {
            response.end(JSON.stringify(err));
        });
        call.on("data", (res) => {
            response.end(JSON.stringify(res));
        });
        call.write({ uri: uri });
        call.end();
    }
}).listen(3000);

