pipeline {
    agent any

    environment {
        IMAGE_NAME = "jovishajv/capstone_proj_repo"
        EC2_HOST = "98.130.46.163"
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
                    .venv/bin/python -m pip install --upgrade pip
                    .venv/bin/python -m pip install -r requirements.txt
                    .venv/bin/python -m pytest tests/
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
                    credentialsId: 'dochub-token',
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
                sh '''
                    docker pull $IMAGE_NAME:latest

                    docker stop capstone_proj_repo || true
                    docker rm capstone_proj_repo || true

                    docker run -d \
                        --name capstone_proj_repo \
                        --restart unless-stopped \
                        -p 5000:5000 \
                        $IMAGE_NAME:latest

                    docker ps
                '''
            }
}

    }
}
