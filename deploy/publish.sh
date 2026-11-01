#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
app_image="${1:?Usage: publish.sh image:tag}"
app_dir=/opt/1panel/apps/supply-chain-admin/supply-chain-admin
jenkins_image=$(docker inspect --format '{{.Image}}' jenkins)
tar -cf - -C deploy docker-compose.yml |
    docker run --rm -i --user 0 --entrypoint bash \
        --mount "type=bind,src=$app_dir,dst=$app_dir" \
        --mount type=bind,src=/usr/bin/docker,dst=/usr/bin/docker,readonly \
        --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
        --mount type=bind,src=/opt/1panel/apps/jenkins/jenkins/data/.docker/cli-plugins,dst=/root/.docker/cli-plugins,readonly \
        -e DOCKER_CONFIG=/root/.docker -e "APP_DIR=$app_dir" -e "APP_IMAGE=$app_image" \
        "$jenkins_image" -c 'set -euo pipefail; tar -xf - -C "$APP_DIR"; cd "$APP_DIR"; docker compose config --quiet; printf "APP_IMAGE=%s\n" "$APP_IMAGE" > .env; docker compose up -d --wait --wait-timeout 90'
