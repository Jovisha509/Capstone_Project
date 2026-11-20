pipeline {
    agent any

    environment {
        IMAGE_NAME = "jovishajv/iot-dashboard"
        EC2_HOST = "40.192.2.44"
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/Jovisha509/Capstone_Project.git'
            }
        }

        stage('Test') {
            steps {
                sh '''
                    python3 -m venv .venv
                    . .venv/bin/activate
                    pip install -r requirements.txt
                    pytest
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t $IMAGE_NAME:latest .'
            }
        }

        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_TOKEN'
                )]) {
                    sh '''
                        echo "$DOCKER_TOKEN" | docker login \
                            -u "$DOCKER_USER" --password-stdin
                        docker push $IMAGE_NAME:latest
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy to EC2') {
            steps {
                sshagent(credentials: ['ec2-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=yes ubuntu@$EC2_HOST '
                            sudo docker pull $IMAGE_NAME:latest
                            sudo docker stop iot-dashboard || true
                            sudo docker rm iot-dashboard || true
                            sudo docker run -d \
                                --name iot-dashboard \
                                --restart unless-stopped \
                                -p 5000:5000 \
                                $IMAGE_NAME:latest
                        '
                    '''
                }
            }
        }
    }
}
