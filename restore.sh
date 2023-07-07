#!/bin/bash

usage() {
    echo "Usage: $0 [ -d <DB_NAME> ] [ -p <DUMP_PATH> ]" 1>&2 
}

while getopts ":d:p:" arg; do
    case $arg in
        d) DB_NAME=$OPTARG;;
        p) PATH=$OPTARG;;
        *) usage
            exit 0
            ;;
    esac
done

if [ -z "$DB_NAME" ] || [ -z "$PATH" ]; then
        echo 'Missing -d or -p' >&2
        exit 1
fi

MONGO_URL="mongodb://root:root@localhost:27017/$DB_NAME?authSource=admin"

/usr/bin/mongorestore --uri=$MONGO_URL --db=$DB_NAME $PATH