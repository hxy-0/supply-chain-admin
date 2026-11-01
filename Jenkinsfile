pipeline {
    agent any
    options {
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15'))
    }
    triggers { pollSCM('H/2 * * * *') }
    environment { DOCKER_CONFIG = '/var/jenkins_home/.docker' }
    stages {
        stage('Build') {
            steps { sh 'docker build --pull -t supply-chain-admin:$GIT_COMMIT .' }
        }
        stage('Deploy') {
            steps { sh 'bash deploy/publish.sh supply-chain-admin:$GIT_COMMIT' }
        }
    }
}
