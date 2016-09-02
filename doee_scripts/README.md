# Preparing DOEE Data for Carto

## Requirements

- Postgresql 9.3 and PostGIS 2.x

- Python3.x

- Python virtualenv

## DOEE Data

The following sections begin with the assumption that the DOEE has handed over yearly pipe-delimited text files:

0. The text files have an agreed upon schema ( see the `CREATE TABLE` statment in `load_doee.sh` ) ( not always the case )

0. The numeric energy columns have been scrubbed of strings suchs as `N/A` and `Not Available` ( not always the case )

0. The text columns have been scrubbed of carriage returns that might interfere with loading ( not always the case )

## Loading and Geocoding

0. clone this repo

0. cd to `cityenergy-dc/doee_scripts`

0. drop the yearly text files into this directory

0. the scripts `load_doee.sh` and  `geocode_doee.py` rely on certain environment variables to be set:

    ```bash
    DBNAME=<your-database-name> 
    DBUSER=<your-database-user>
    TABLE=<your-database-table-name>
    CSVNAME=<target-csv-base-name> 
    ```
0. for example, to run `load_doee.sh` on a `2010.csv` pipe-delimitted file you'd run the following:

    ```bash
    $ DBNAME=cityenergy TABLE=properties_2010 CSVNAME=2010 DBUSER=doee ./load_doee.sh    
    ```
0. run `load_doee.sh` and make sure it loaded everything correctly

0. setup your Python virtualenv to get ready to run the geocoding:

    ```bash
    $ virtualenv --python=python3 venv
    $ source venv/bin/activate
    $ pip install -r requirements.txt 
    ```
0. go get a Google API key and add it to the `geocode_doee.py` script

0. run the geocoding script (depending on whether you hit the API rate limit or have timeouts, you might have to run it multiple times with different API keys):

    ```bash
    DBNAME=cityenergy DBUSER=doee TABLE=properties_2010 python geocode_doee.py
    ```
0. finally, export the table to a CSV so it can be loaded into CartoDB:

    ```bash
    psql -d cityenergy -c "COPY (SELECT * FROM properties_2014) TO '/tmp/t2014.csv' With CSV  HEADER DELIMITER '|';"
    ```
