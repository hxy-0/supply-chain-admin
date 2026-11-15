pipeline {
    agent any
    options {
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15'))
    }
    triggers { pollSCM('H/2 * * * *') }
    environment {
        DOCKER_CONFIG = '/var/jenkins_home/.docker'
        DOCKER_BUILDKIT = '1'
    }
    stages {
        stage('Build') {
            steps {
                // shortcut: reuse cached base images during registry DNS outages; restore --pull when registry access is reliable.
                sh 'docker build --progress=plain -t supply-chain-admin:$GIT_COMMIT .'
            }
        }
        stage('Deploy') {
            steps { sh 'bash deploy/publish.sh supply-chain-admin:$GIT_COMMIT' }
        }
    }
}
