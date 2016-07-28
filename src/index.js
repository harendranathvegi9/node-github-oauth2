/**
 * Created by amitthakkar on 13/07/16.
 */
'use strict';
// Dependencies
const SIMPLE_OAUTH2 = require('simple-oauth2');
const RANDOM_STRING = require("randomstring");
const QUERY_STRING = require('querystring');
const GITHUB = require("github");
const SPAWN = require('child_process').spawn;
const BLUE_BIRD = require('bluebird');

// Constants
const PROTOCOL = 'https';
const HOST = 'api.github.com';
const GITHUB_LOGIN_URL = PROTOCOL + '://github.com/login';
const OAUTH_ACCESS_TOKEN_PATH = '/oauth/access_token';
const OAUTHORIZATION_PATH = '/oauth/authorize';

let oauth2, clientId, clientSecret, redirectURI, scope, gitDirectory, github;

class NodeGithubOAuth2 {
    constructor(options) {
        clientId = options.clientId;
        clientSecret = options.clientSecret;
        redirectURI = options.redirectURI;
        scope = options.scope;
        gitDirectory = options.gitDirectory;
        github = new GITHUB({
            protocol: PROTOCOL,
            host: HOST,
            pathPrefix: "",
            headers: {
                "user-agent": options.userAgent
            },
            Promise: BLUE_BIRD,
            followRedirects: false,
            timeout: 5000
        });
        this.initialize();
    }

    initialize() {
        let randomString = RANDOM_STRING.generate({});
        oauth2 = SIMPLE_OAUTH2({
            clientID: clientId,
            clientSecret: clientSecret,
            site: GITHUB_LOGIN_URL,
            tokenPath: OAUTH_ACCESS_TOKEN_PATH,
            authorizationPath: OAUTHORIZATION_PATH
        });
    }

    getRedirectURL(state) {
        return oauth2.authCode.authorizeURL({
            redirect_uri: redirectURI,
            scope: scope,
            state: state
        });
    }

    getToken(request, response, next) {
        let code = request.query.code;
        let state = request.query.state;
        oauth2.authCode.getToken({
            code: code,
            redirect_uri: redirectURI
        }, (error, result) => {
            if (error) {
                next(error);
            } else {
                request.token = QUERY_STRING.parse(result).access_token;
                request.state = state;
                next();
            }
        });
    }

    authenicateGithubWithToken(token) {
        github.authenticate({
            type: "oauth",
            token: token
        });
    }

    getOrganizations(options, callback) {
        this.authenicateGithubWithToken(options.token);
        github.users.getOrgs({}, callback);
    }

    createRepoAndCloneProject(options, callback) {
        this.authenicateGithubWithToken(options.token);
        github.repos.createForOrg({
            org: options.org,
            name: options.name,
            description: options.discription,
            private: options.private || false
        }, function (err, result) {
            let gitURL = 'https://' + options.token + '@github.com/' + options.org + '/' + options.name + '.git'
            const ls = SPAWN('git', ['clone', gitURL, gitDirectory + options.name]);
            ls.stdout.on('data', (data) => {
                callback(null, data.toString());
            });
            ls.stderr.on('data', (error) => {
                callback(error.toString());
            });
            ls.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
            });
        })
    }

    deleteGithubRepo(options, callback) {
        this.authenicateGithubWithToken(options.token);
        github.repos.delete({repo: options.name, user: options.org}, callback);
    }

    addCollaborator(options, callback) {
        this.authenicateGithubWithToken(options.token);
        github.repos.addCollaborator({
            user: options.user,
            repo: options.repo,
            collabuser: options.collabuser,
            permission: options.permission
        }, callback);
    }

    removeCollaborator(options, callback) {
        this.authenicateGithubWithToken(options.token);
        github.repos.removeCollaborator({
            user: options.user,
            repo: options.repo,
            collabuser: options.collabuser
        }, callback);
    }

    commitAndPush(options, callback) {
        const gitCommand = SPAWN(['source', '../scripts/commitAndPush.sh', gitDirectory + options.name, options.userName, options.email, options.email].join(' '));
        gitCommand.stdout.on('data', (data) => {
            callback(null, data.toString());
        });
        gitCommand.stderr.on('data', (error) => {
            callback(error.toString());
        });
        gitCommand.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
    }

    searchByEmail(options, callback) {
        this.authenicateGithubWithToken(options.token);
        github.search.email({
            email: options.email
        }, callback);
    }

    getUser(options, callback) {
        this.authenicateGithubWithToken(options.token);
        github.users.get({}, callback);
    }
}

module.exports = function (options) {
    return new NodeGithubOAuth2(options);
};