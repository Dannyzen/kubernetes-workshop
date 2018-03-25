# Kubernetes Workshop

This workshop will walk you through deploying a Node.js microservices stack with Kubernetes.

## Optional: Set up local environment

This tutorial launches a Kubernetes cluster on [Google Kubernetes Engine](https://cloud.google.com/kubernetes-engine/)

If you are running this tutorial at home, you will need a Google Cloud Platform account. If you don't have one, sign up for the [free trial](https://cloud.google.com/free).

To complete this tutorial, you will need the following tools installed:

 - [Kubernetes CLI](https://github.com/kubernetes/kubernetes/blob/master/CHANGELOG.md#client-binaries)
 - [gcloud SDK](https://cloud.google.com/sdk)

 We will also use a set of Google Cloud APIs that you can [enable here](https://console.cloud.google.com/flows/enableapi?apiid=container.googleapis.com,cloudbuild.googleapis.com) all together.
 - [Kubernetes Engine API](https://console.cloud.google.com/apis/api/container.googleapis.com/overview)
 - [Container Builder API](https://console.cloud.google.com/apis/api/cloudbuild.googleapis.com/overview)

You can also use [Google Cloud Shell](https://cloud.google.com/shell), a free VM that has all these tools pre-installed.

## Preparation: Create the container image

This walkthrough comes built with a simple [nodejs hello world app.](hello-node/server.js) It runs on port 8080 and responds to a `curl` with "hi there"

### Build the image

1. `git clone` this repository

1. `cd ./hello-node` into the directory and `docker build -t gcr.io/google.com/{PROJECT-ID}/hello-node:1 .` 

Note: If your project-id contains a ":" (eg: `example.com:project-foo`) replace `:` with `/` 

Note: Getting an error around accessing the docker agent? Did you just `sudo` to fix it? Add your user to the docker group with `sudo usermod -aG docker $USER`. You'll need this for later, so better to do it now.

Great! You have built a docker image, next we'll tag it so it has the appropriate meta-data for Google Cloud Container builder to consume

### Tag the image

1. docker tag hello-node gcr.io/{PROJECT-ID}/hello-node:v1

Note: If your project-id contains a ":" (eg: `example.com:project-foo`) replace `:` with `/` 

Awesome. Your image has the metadata it needs to be understood by machines _and_ humanity. Conciousness is a wonderful thing. 


## Push that image to Google Cloud Container builder

1. gcloud docker -- push gcr.io/{PROJECT-ID}/hello-node:v1

Note: If your project-id contains a ":" (eg: `example.com:project-foo`) replace `:` with `/` 

Things are looking good now! Your container containing the sample nodejs app is now up and available in your google cloud project:

## Create Cluster 

1. Create a cluster, assuming you want it in us-central1-a:

`gcloud container clusters create hello-node --num-nodes 2 --machine-type n1-standard-1 --zone us-central1-a`

If you get an error, make sure you enable the Kubernetes Engine API [here](https://console.cloud.google.com/apis/api/container.googleapis.com/overview).

Excellent. You've created your cluster, but nothing is running inside it. Let's fix that.

## Run your container in the cluster

1. `kubectl run hello-node --image=gcr.io/{PROJECT-ID}/hello-node:v1 -port=8080`

We've just created a deployment object! You should see something like `deployment "hello-node" created`

Check out what the deployment looks like with `kubectl get deployments`

1. View your pod with `kubectl get pods` a favorable result might look something like:

```
NAME                         READY     STATUS    RESTARTS   AGE
hello-node-7b897746b5-thcm2   1/1       Running   0          6m
```

Learn more things! Try `kubectl cluster-info` and `kubectl config view` something broken? `kubectl get events` and `kubectl logs {pod_name}`

## Expose your deployment to the internet and feel that "hello world" glory

1. Expose ther service and obtain an externally accessible IP with: 

`kubectl expose deployment hello-node --type="LoadBalancer"`

The respond should be something like `service "hello-node" exposed`

1. Get the publicy-accessible IP of the service and curl!

`kubectl getr services`

It may take a few moments for the public IP to be provided. Run `watch -n 10 kubectl get services` to monitor changes every 10 seconds

Eventually you'll see something like

```
NAME         TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)          AGE
hello-node   LoadBalancer   10.39.245.0   35.223.161.100   8080:32630/TCP   31m
kubernetes   ClusterIP      10.39.240.1   <none>           443/TCP          6h
```

Well look at that! You've got an external ip _and_ a cluster ip.  Tip is all we care about, but let your imagine think about what could be done with the cluster ip!

1. `curl {EXTERNAL-IP}:8080` should respond with a glorious "Hi there"

Feels good, right? 

## Scale up deployment

One pod is not enough. Let's get 5 of them!

1. `kubectl scale deployment hello-node --replicas=5`

You can see the all pods with this command:

`kubectl get pods`

## Step 3: Hello world is boring, let's update the app

The new app will take a picture, flip it around, and return it.

You can see the source code [here](./rolling-update/index.js).

The Dockerfile for this container can be [found here](./rolling-update/Dockerfile).

Build the Docker Container using [Google Container Builder](https://console.cloud.google.com/gcr):

`gcloud container builds submit --tag gcr.io/$DEVSHELL_PROJECT_ID/imageflipper:1.0 ./rolling-update/`

This will automatically build and push this Docker image to [Google Container Registry](https://gcr.io).

Now, we are going to update the deployment created in the first step. You can see the new YAML file [here](/rolling-update/deployment.yaml).

Replace the <PROJECT_ID> placeholder with your Project ID. Use this command to do it automatically:

`sed -i "s~<PROJECT_ID>~$DEVSHELL_PROJECT_ID~g" ./rolling-update/deployment.yaml`

Now use the apply command to update the deployment. The only change to this file from the first deployment.yaml is the new container image.

`kubectl apply -f ./rolling-update/deployment.yaml`

This will replace all the old containers with the new ones. Kubernetes will perform a rolling update; it will delete one old container at a time and replace it with a new one.

You can watch the containers being updated with this command:

`watch kubectl get pods`

Once it is done, press `ctrl + c` to quit.

If you visit the website now, you can see the updated website!

## Step 4: Backend Service

The web frontend is created, but let's split the monolith into microservices. The backend service will do the image manipulation and will expose a REST API that the frontend service will communicate with.

You can see the source code for the service [here](./second-service/index.js).

Build the Docker Container using [Google Container Builder](https://cloud.google.com/container-builder):

`gcloud container builds submit --tag gcr.io/$DEVSHELL_PROJECT_ID/annotate:1.0 ./second-service/`

The service.yaml file for the backend service is very similar to the frontend service, but it does not specify `type: LoadBalancer`. This will prevent Kubernetes from spinning up a Cloud Load Balancer, and instead the service will only be accessable from inside the cluster.

Run the backend [deployment](./second-service/deployment.yaml):

`sed -i "s~<PROJECT_ID>~$DEVSHELL_PROJECT_ID~g" ./second-service/deployment.yaml`

`kubectl apply -f ./second-service/deployment.yaml`

Expose the container with a [service](./second-service/service.yaml):

`kubectl apply -f ./second-service/service.yaml`

## Step 5: Update Frontend Service to use the Backend with a Blue-Green deployment

Now the backend service is running, you need to update the frontend to use the new backend.

The new code is [here](./blue-green/index.js).

Instead of doing a rolling update like we did before, we are going to use a Blue-Green strategy.

This means we will spin up a new deployment of the frontend, wait until all containers are created, then configure the service to send traffic to the new deployment, and finally spin down the old deployment. This allows us to make sure that users don't get different versions of the app, smoke test the new deployment at scale, and a few other benefits. You can read more about [Blue-Green Deployments vs Rolling Updates here](http://stackoverflow.com/questions/23746038/canary-release-strategy-vs-blue-green).

Build the Docker Container using [Google Container Builder](https://cloud.google.com/container-builder):

`gcloud container builds submit --tag gcr.io/$DEVSHELL_PROJECT_ID/imageflipper:2.0 ./blue-green/`

Spin up the the new deployment with the following command:

`sed -i "s~<PROJECT_ID>~$DEVSHELL_PROJECT_ID~g" ./blue-green/deployment.yaml`

`kubectl apply -f ./blue-green/deployment.yaml`

You can see all the containers running with this command:

`kubectl get pods`

Now, we need to edit the service to point to this new deployment. The new service definition is [here](./blue-green/service.yaml). Notice the only thing we changed is the selector.

`kubectl apply -f ./blue-green/service.yaml`

At this point, you can visit the website and the new code will be live. Once you are happy with the results, you can turn down the green deployment.

`kubectl scale deployment hello-node-green --replicas=0`
