const async = require('async');

const PROTO_PATH = __dirname + '/urifetch.proto';
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

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

const port = 50051;

// SERVICE INTERFACE

const server = new grpc.Server();
server.bind('0.0.0.0:'+port, grpc.ServerCredentials.createInsecure());

function getContent(call, callback) {
    const response = {
        uri: call.request.uri,
        content: "Not found"
    };
    callback(null, response);
}

function streamContent(call) {
    call.on('data', (uri) => {
        const response = {
            uri: uri.uri,
            content: 'Not found'
        };
        call.write(response);
    });
    call.on('end', function() {
        call.end();
    });
}

server.addService(uriFetch.URIFetch.service, {
    getContent: getContent,
    streamContent: streamContent
});
server.start();


// CLIENT INTERFACE

const client = new uriFetch.URIFetch('localhost:'+port, grpc.credentials.createInsecure());

const express = require('express');
const app = express();

app.get('/get-content', function (req, res) {
    client.getContent({ uri: req.query.uri }, (err, uriContent) => {
        console.log(err, uriContent);
        if (err) {
            // process error
            res.send(uriContent);
        } else {
            // process feature
            res.send(uriContent);
        }
    });
});

app.get('/stream-content', function (req, res) {
    const call = client.streamContent();
    call.on('data', function(uriContent) {
        console.log('Received: ' + JSON.stringify(uriContent));
    });

    'Hello World!'.split("").forEach(uri => {
        call.write({ uri: uri });
    });

    call.end();
    res.send();
});

app.listen(3000);
